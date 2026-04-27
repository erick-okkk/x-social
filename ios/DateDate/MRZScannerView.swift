import SwiftUI
import AVFoundation
import Vision

// MARK: - SwiftUI Wrapper
struct MRZScannerView: UIViewControllerRepresentable {
    var onFound: (String) -> Void
    
    func makeUIViewController(context: Context) -> MRZScannerViewController {
        let vc = MRZScannerViewController()
        vc.completionHandler = onFound
        return vc
    }
    
    func updateUIViewController(_ uiViewController: MRZScannerViewController, context: Context) {}
}

// MARK: - Preview View for Camera
class PreviewView: UIView {
    var videoPreviewLayer: AVCaptureVideoPreviewLayer {
        guard let layer = layer as? AVCaptureVideoPreviewLayer else {
            fatalError("Expected AVCaptureVideoPreviewLayer")
        }
        return layer
    }
    
    var session: AVCaptureSession? {
        get { videoPreviewLayer.session }
        set { videoPreviewLayer.session = newValue }
    }
    
    override class var layerClass: AnyClass {
        return AVCaptureVideoPreviewLayer.self
    }
}

// MARK: - MRZ Scanner View Controller
class MRZScannerViewController: UIViewController {
    
    // UI
    private var previewView: PreviewView!
    private var cutoutView: UIView!
    private var statusLabel: UILabel!
    private var maskLayer = CAShapeLayer()
    private var boxLayers = [CAShapeLayer]()
    
    // Capture
    private let captureSession = AVCaptureSession()
    private let captureSessionQueue = DispatchQueue(label: "CaptureSessionQueue")
    private let videoDataOutputQueue = DispatchQueue(label: "VideoDataOutputQueue")
    private var videoDataOutput = AVCaptureVideoDataOutput()
    
    // Vision
    private var request: VNRecognizeTextRequest!
    private var regionOfInterest = CGRect(x: 0, y: 0, width: 1, height: 1)
    private var textOrientation = CGImagePropertyOrientation.up
    
    // Transforms
    private var bufferAspectRatio: Double = 1920.0 / 1080.0
    private var uiRotationTransform = CGAffineTransform.identity
    private var bottomToTopTransform = CGAffineTransform(scaleX: 1, y: -1).translatedBy(x: 0, y: -1)
    private var roiToGlobalTransform = CGAffineTransform.identity
    private var visionToAVFTransform = CGAffineTransform.identity
    
    // MRZ Tracking
    private let mrzTracker = MRZStringTracker()
    var completionHandler: ((String) -> Void)?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        request = VNRecognizeTextRequest(completionHandler: recognizeTextHandler)
        
        setupUI()
        
        captureSessionQueue.async {
            self.setupCamera()
            DispatchQueue.main.async {
                self.calculateRegionOfInterest()
            }
        }
    }
    
    private func setupUI() {
        previewView = PreviewView()
        cutoutView = UIView()
        statusLabel = UILabel()
        
        previewView.translatesAutoresizingMaskIntoConstraints = false
        cutoutView.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(previewView)
        view.addSubview(cutoutView)
        view.addSubview(statusLabel)
        
        NSLayoutConstraint.activate([
            previewView.topAnchor.constraint(equalTo: view.topAnchor),
            previewView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            previewView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            previewView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            
            cutoutView.topAnchor.constraint(equalTo: view.topAnchor),
            cutoutView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            cutoutView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            cutoutView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            
            statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusLabel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20)
        ])
        
        previewView.session = captureSession
        
        cutoutView.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        maskLayer.backgroundColor = UIColor.clear.cgColor
        maskLayer.fillRule = .evenOdd
        cutoutView.layer.mask = maskLayer
        
        statusLabel.text = "Align MRZ within the frame"
        statusLabel.textColor = .white
        statusLabel.font = .systemFont(ofSize: 16, weight: .medium)
        statusLabel.textAlignment = .center
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateCutout()
    }
    
    // MARK: - Region of Interest
    private func calculateRegionOfInterest() {
        let desiredHeightRatio = 0.15
        let desiredWidthRatio = 0.9
        let maxPortraitWidth = 0.9
        
        let size: CGSize
        if view.bounds.width < view.bounds.height {
            size = CGSize(width: min(desiredWidthRatio * bufferAspectRatio, maxPortraitWidth), height: desiredHeightRatio)
        } else {
            size = CGSize(width: desiredWidthRatio, height: desiredHeightRatio * bufferAspectRatio)
        }
        
        regionOfInterest = CGRect(
            x: (1 - size.width) / 2,
            y: (1 - size.height) / 2,
            width: size.width,
            height: size.height
        )
        
        setupOrientationAndTransform()
        
        DispatchQueue.main.async {
            self.updateCutout()
        }
    }
    
    private func updateCutout() {
        let roiRectTransform = bottomToTopTransform.concatenating(uiRotationTransform)
        let cutout = previewView.videoPreviewLayer.layerRectConverted(
            fromMetadataOutputRect: regionOfInterest.applying(roiRectTransform)
        )
        
        let path = UIBezierPath(rect: cutoutView.frame)
        path.append(UIBezierPath(roundedRect: cutout, cornerRadius: 8))
        maskLayer.path = path.cgPath
    }
    
    private func setupOrientationAndTransform() {
        let roi = regionOfInterest
        roiToGlobalTransform = CGAffineTransform(translationX: roi.origin.x, y: roi.origin.y)
            .scaledBy(x: roi.width, y: roi.height)
        
        textOrientation = .right
        uiRotationTransform = CGAffineTransform(translationX: 0, y: 1).rotated(by: -CGFloat.pi / 2)
        
        visionToAVFTransform = roiToGlobalTransform
            .concatenating(bottomToTopTransform)
            .concatenating(uiRotationTransform)
    }
    
    // MARK: - Camera Setup
    private func setupCamera() {
        guard let captureDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            print("Could not create capture device.")
            return
        }
        
        if captureDevice.supportsSessionPreset(.hd4K3840x2160) {
            captureSession.sessionPreset = .hd4K3840x2160
            bufferAspectRatio = 3840.0 / 2160.0
        } else {
            captureSession.sessionPreset = .hd1920x1080
            bufferAspectRatio = 1920.0 / 1080.0
        }
        
        guard let deviceInput = try? AVCaptureDeviceInput(device: captureDevice) else {
            print("Could not create device input.")
            return
        }
        
        if captureSession.canAddInput(deviceInput) {
            captureSession.addInput(deviceInput)
        }
        
        videoDataOutput.alwaysDiscardsLateVideoFrames = true
        videoDataOutput.setSampleBufferDelegate(self, queue: videoDataOutputQueue)
        videoDataOutput.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]
        
        if captureSession.canAddOutput(videoDataOutput) {
            captureSession.addOutput(videoDataOutput)
            videoDataOutput.connection(with: .video)?.preferredVideoStabilizationMode = .off
        }
        
        do {
            try captureDevice.lockForConfiguration()
            captureDevice.videoZoomFactor = 1.5
            captureDevice.autoFocusRangeRestriction = .near
            captureDevice.unlockForConfiguration()
        } catch {
            print("Could not set zoom level: \(error)")
        }
        
        captureSession.startRunning()
    }
    
    // MARK: - Vision Text Recognition
    private func recognizeTextHandler(request: VNRequest, error: Error?) {
        var redBoxes = [CGRect]()
        var greenBoxes = [CGRect]()
        var codes = [String]()
        
        guard let results = request.results as? [VNRecognizedTextObservation] else { return }
        
        for visionResult in results {
            guard let candidate = visionResult.topCandidates(1).first else { continue }
            
            let text = candidate.string.replacingOccurrences(of: " ", with: "")
            
            if let mrz = text.checkMRZ() {
                codes.append(mrz)
                greenBoxes.append(visionResult.boundingBox)
            } else {
                redBoxes.append(visionResult.boundingBox)
            }
        }
        
        mrzTracker.logFrame(strings: codes)
        showBoxGroups([(UIColor.red.cgColor, redBoxes), (UIColor.green.cgColor, greenBoxes)])
        
        if let stableMRZ = mrzTracker.getStableString() {
            captureSessionQueue.sync {
                self.captureSession.stopRunning()
            }
            mrzTracker.reset(string: stableMRZ)
            
            DispatchQueue.main.async {
                self.completionHandler?(stableMRZ)
            }
        }
    }
    
    // MARK: - Box Drawing
    private func showBoxGroups(_ groups: [(color: CGColor, boxes: [CGRect])]) {
        DispatchQueue.main.async {
            self.removeBoxes()
            let layer = self.previewView.videoPreviewLayer
            for group in groups {
                for box in group.boxes {
                    let rect = layer.layerRectConverted(fromMetadataOutputRect: box.applying(self.visionToAVFTransform))
                    self.drawBox(rect: rect, color: group.color)
                }
            }
        }
    }
    
    private func drawBox(rect: CGRect, color: CGColor) {
        let layer = CAShapeLayer()
        layer.opacity = 0.5
        layer.borderColor = color
        layer.borderWidth = 2
        layer.frame = rect
        boxLayers.append(layer)
        previewView.videoPreviewLayer.insertSublayer(layer, at: 1)
    }
    
    private func removeBoxes() {
        for layer in boxLayers {
            layer.removeFromSuperlayer()
        }
        boxLayers.removeAll()
    }
}

// MARK: - AVCaptureVideoDataOutputSampleBufferDelegate
extension MRZScannerViewController: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        
        request.recognitionLevel = .fast
        request.usesLanguageCorrection = false
        request.regionOfInterest = regionOfInterest
        
        let requestHandler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: textOrientation, options: [:])
        do {
            try requestHandler.perform([request])
        } catch {
            print("Vision error: \(error)")
        }
    }
}

// MARK: - MRZ String Extensions
private var captureFirst = ""
private var captureSecond = ""

extension String {
    func checkMRZ() -> String? {
        let tdThreeFirstRegex = "P[A-Z<][A-Z<]{3}[A-Z<]{39}"
        let tdThreeSecondRegex = "[A-Z0-9<]{9}[0-9][A-Z<]{3}[0-9]{6}[0-9][MF<][0-9]{6}[0-9][A-Z0-9<]{14}[0-9<][0-9]"
        
        let stripped = self.stripped
        
        if stripped.range(of: tdThreeFirstRegex, options: .regularExpression) != nil && stripped.count == 44 {
            captureFirst = stripped
        }
        
        if stripped.range(of: tdThreeSecondRegex, options: .regularExpression) != nil && stripped.count == 44 {
            captureSecond = stripped
        }
        
        if captureFirst.count == 44 && captureSecond.count == 44 {
            let mrz = captureFirst + "\n" + captureSecond
            return mrz
        }
        
        return nil
    }
    
    var stripped: String {
        let okayChars = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890<")
        return self.uppercased().filter { okayChars.contains($0) }
    }
}

// MARK: - MRZ String Tracker
class MRZStringTracker {
    private var frameIndex: Int64 = 0
    private var seenStrings = [String: (lastSeen: Int64, count: Int64)]()
    private var bestCount: Int64 = 0
    private var bestString = ""
    
    func logFrame(strings: [String]) {
        for string in strings {
            if seenStrings[string] == nil {
                seenStrings[string] = (lastSeen: 0, count: 0)
            }
            seenStrings[string]?.lastSeen = frameIndex
            seenStrings[string]?.count += 1
        }
        
        // Remove stale strings
        var obsolete = [String]()
        for (key, value) in seenStrings {
            if frameIndex - value.lastSeen > 30 {
                obsolete.append(key)
            }
        }
        for key in obsolete {
            seenStrings.removeValue(forKey: key)
        }
        
        frameIndex += 1
    }
    
    func getStableString() -> String? {
        for (key, value) in seenStrings {
            if value.count > bestCount {
                bestCount = value.count
                bestString = key
            }
        }
        // Return if seen enough times
        if bestCount >= 10 {
            return bestString
        }
        return nil
    }
    
    func reset(string: String) {
        seenStrings.removeValue(forKey: string)
        bestCount = 0
        bestString = ""
        captureFirst = ""
        captureSecond = ""
    }
}
