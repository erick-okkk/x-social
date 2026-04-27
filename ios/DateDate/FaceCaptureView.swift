import SwiftUI
import AVFoundation
import Vision

struct FaceCaptureView: UIViewControllerRepresentable {
    var passportImage: UIImage
    var onCapture: (UIImage, FaceComparisonResult) -> Void
    @Environment(\.dismiss) private var dismiss
    
    func makeUIViewController(context: Context) -> FaceCaptureViewController {
        let vc = FaceCaptureViewController()
        vc.passportImage = passportImage
        vc.onCapture = { image, result in
            onCapture(image, result)
        }
        return vc
    }
    
    func updateUIViewController(_ uiViewController: FaceCaptureViewController, context: Context) {}
}

class FaceCaptureViewController: UIViewController {
    
    private var captureSession: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var videoOutput: AVCaptureVideoDataOutput?
    
    private var faceGuideView: UIView!
    private var instructionLabel: UILabel!
    private var similarityLabel: UILabel!
    private var similarityProgressView: UIProgressView!
    private var captureButton: UIButton!
    private var debugLabel: UILabel!
    
    private let videoDataOutputQueue = DispatchQueue(label: "VideoDataOutputQueue")
    
    var passportImage: UIImage?
    var onCapture: ((UIImage, FaceComparisonResult) -> Void)?
    
    // Store latest frame and similarity
    private var latestFrame: UIImage?
    private var latestSimilarity: Float = 0
    private var latestResult: FaceComparisonResult?
    private var isProcessing = false
    
    // Pre-extracted passport face features
    private var passportLandmarks: VNFaceLandmarks2D?
    
    // Time window for similarity tracking (3 seconds)
    private let timeWindowDuration: TimeInterval = 3.0
    private var similarityHistory: [(timestamp: Date, similarity: Float)] = []
    private var comparisonStartTime: Date?
    private var hasAutoDecided = false  // Prevent multiple auto-decisions
    
    // Thresholds
    private let successThreshold: Float = 0.70  // 70% for success
    private let failureThreshold: Float = 0.65  // 65% for failure
    private let requiredRatio: Float = 0.6      // 60% of samples must meet threshold
    
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        
        // Pre-extract passport face features
        Task {
            await extractPassportFaceLandmarks()
        }
        
        // Start comparison timer
        comparisonStartTime = Date()
        
        setupCamera()
        setupUI()
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }
    
    private func extractPassportFaceLandmarks() async {
        guard let passportImg = passportImage, let cgImage = passportImg.cgImage else { return }
        
        passportLandmarks = await withCheckedContinuation { continuation in
            let request = VNDetectFaceLandmarksRequest { request, error in
                guard error == nil,
                      let results = request.results as? [VNFaceObservation],
                      let face = results.first,
                      let landmarks = face.landmarks else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: landmarks)
            }
            
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
            } catch {
                continuation.resume(returning: nil)
            }
        }
    }
    
    private func setupCamera() {
        captureSession = AVCaptureSession()
        captureSession?.sessionPreset = .high
        
        guard let frontCamera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
              let input = try? AVCaptureDeviceInput(device: frontCamera) else {
            showError("Unable to access front camera")
            return
        }
        
        if captureSession?.canAddInput(input) == true {
            captureSession?.addInput(input)
        }
        
        // 设置视频输出用于实时处理
        videoOutput = AVCaptureVideoDataOutput()
        videoOutput?.alwaysDiscardsLateVideoFrames = true
        videoOutput?.setSampleBufferDelegate(self, queue: videoDataOutputQueue)
        videoOutput?.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        
        if let videoOutput = videoOutput, captureSession?.canAddOutput(videoOutput) == true {
            captureSession?.addOutput(videoOutput)
            
            // 设置视频方向
            if let connection = videoOutput.connection(with: .video) {
                connection.videoOrientation = .portrait
                connection.isVideoMirrored = true
            }
        }
        
        previewLayer = AVCaptureVideoPreviewLayer(session: captureSession!)
        previewLayer?.videoGravity = .resizeAspectFill
        previewLayer?.frame = view.bounds
        view.layer.addSublayer(previewLayer!)
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession?.startRunning()
        }
    }
    
    private func setupUI() {
        // 人脸引导框
        faceGuideView = UIView()
        faceGuideView.translatesAutoresizingMaskIntoConstraints = false
        faceGuideView.backgroundColor = .clear
        faceGuideView.layer.borderColor = UIColor.white.cgColor
        faceGuideView.layer.borderWidth = 3
        faceGuideView.layer.cornerRadius = 120
        view.addSubview(faceGuideView)
        
        // 相似度进度条
        similarityProgressView = UIProgressView(progressViewStyle: .default)
        similarityProgressView.translatesAutoresizingMaskIntoConstraints = false
        similarityProgressView.progressTintColor = .red
        similarityProgressView.trackTintColor = .darkGray
        similarityProgressView.transform = CGAffineTransform(scaleX: 1, y: 3)
        view.addSubview(similarityProgressView)
        
        // 相似度数值标签
        similarityLabel = UILabel()
        similarityLabel.translatesAutoresizingMaskIntoConstraints = false
        similarityLabel.text = "Similarity: ---%"
        similarityLabel.textColor = .white
        similarityLabel.font = .systemFont(ofSize: 32, weight: .bold)
        similarityLabel.textAlignment = .center
        view.addSubview(similarityLabel)
        
        // 调试信息标签
        debugLabel = UILabel()
        debugLabel.translatesAutoresizingMaskIntoConstraints = false
        debugLabel.text = "Waiting for face detection..."
        debugLabel.textColor = .yellow
        debugLabel.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        debugLabel.textAlignment = .center
        debugLabel.numberOfLines = 0
        view.addSubview(debugLabel)
        
        // 说明文字
        instructionLabel = UILabel()
        instructionLabel.translatesAutoresizingMaskIntoConstraints = false
        instructionLabel.text = "Place your face within the frame"
        instructionLabel.textColor = .white
        instructionLabel.font = .systemFont(ofSize: 18, weight: .medium)
        instructionLabel.textAlignment = .center
        view.addSubview(instructionLabel)
        
        // 拍照按钮
        captureButton = UIButton(type: .system)
        captureButton.translatesAutoresizingMaskIntoConstraints = false
        captureButton.setTitle("Confirm", for: .normal)
        captureButton.titleLabel?.font = .systemFont(ofSize: 20, weight: .bold)
        captureButton.setTitleColor(.white, for: .normal)
        captureButton.backgroundColor = UIColor.systemGreen
        captureButton.layer.cornerRadius = 35
        captureButton.addTarget(self, action: #selector(confirmCapture), for: .touchUpInside)
        view.addSubview(captureButton)
        
        // 取消按钮
        let cancelButton = UIButton(type: .system)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.addTarget(self, action: #selector(cancelCapture), for: .touchUpInside)
        view.addSubview(cancelButton)
        
        NSLayoutConstraint.activate([
            faceGuideView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            faceGuideView.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -80),
            faceGuideView.widthAnchor.constraint(equalToConstant: 240),
            faceGuideView.heightAnchor.constraint(equalToConstant: 300),
            
            similarityLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            similarityLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            
            similarityProgressView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            similarityProgressView.topAnchor.constraint(equalTo: similarityLabel.bottomAnchor, constant: 15),
            similarityProgressView.widthAnchor.constraint(equalToConstant: 250),
            
            debugLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            debugLabel.topAnchor.constraint(equalTo: similarityProgressView.bottomAnchor, constant: 10),
            debugLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            debugLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            instructionLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            instructionLabel.topAnchor.constraint(equalTo: faceGuideView.bottomAnchor, constant: 20),
            
            captureButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            captureButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -30),
            captureButton.widthAnchor.constraint(equalToConstant: 70),
            captureButton.heightAnchor.constraint(equalToConstant: 70),
            
            cancelButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10)
        ])
    }
    
    @objc private func confirmCapture() {
        guard let frame = latestFrame, let result = latestResult else {
            showError("Please wait for face detection to complete")
            return
        }
        
        captureSession?.stopRunning()
        onCapture?(frame, result)
        dismiss(animated: true)
    }
    
    @objc private func cancelCapture() {
        captureSession?.stopRunning()
        dismiss(animated: true)
    }
    
    private func showError(_ message: String) {
        let alert = UIAlertController(title: "Error", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    
    private func updateUI(similarity: Float, faceDetected: Bool, debugInfo: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.latestSimilarity = similarity
            
            // Track similarity in time window
            if faceDetected {
                self.trackSimilarity(similarity)
            }
            
            // Update similarity display
            self.similarityLabel.text = String(format: "Similarity: %.1f%%", similarity * 100)
            self.similarityProgressView.progress = similarity
            
            // Update color based on similarity
            let color: UIColor
            if similarity >= self.successThreshold {
                color = .green
            } else if similarity >= self.failureThreshold {
                color = .yellow
            } else {
                color = .red
            }
            
            self.similarityLabel.textColor = color
            self.similarityProgressView.progressTintColor = color
            self.faceGuideView.layer.borderColor = faceDetected ? color.cgColor : UIColor.white.cgColor
            
            // Update debug info with time window stats
            let windowStats = self.getTimeWindowStats()
            var fullDebugInfo = debugInfo
            if let stats = windowStats {
                fullDebugInfo += String(format: "\n\nWindow: %.1fs | Samples: %d", stats.elapsed, stats.count)
                fullDebugInfo += String(format: "\nHigh(≥70%%): %d%% | Low(<65%%): %d%%", 
                    Int(stats.highRatio * 100), Int(stats.lowRatio * 100))
            }
            self.debugLabel.text = fullDebugInfo
            
            // Update instruction text based on time window decision
            if !faceDetected {
                self.instructionLabel.text = "No face detected"
                self.instructionLabel.textColor = .red
            } else {
                self.updateInstructionBasedOnTimeWindow()
            }
        }
    }
    
    // MARK: - Time Window Tracking
    
    private func trackSimilarity(_ similarity: Float) {
        let now = Date()
        
        // Add new sample
        similarityHistory.append((timestamp: now, similarity: similarity))
        
        // Remove samples outside time window
        let cutoff = now.addingTimeInterval(-timeWindowDuration)
        similarityHistory.removeAll { $0.timestamp < cutoff }
        
        // Check for auto-decision after time window is filled
        checkTimeWindowDecision()
    }
    
    private struct TimeWindowStats {
        let count: Int
        let elapsed: TimeInterval
        let highRatio: Float  // Ratio of samples >= 70%
        let lowRatio: Float   // Ratio of samples < 65%
        let avgSimilarity: Float
    }
    
    private func getTimeWindowStats() -> TimeWindowStats? {
        guard let startTime = comparisonStartTime else { return nil }
        
        let elapsed = Date().timeIntervalSince(startTime)
        let count = similarityHistory.count
        
        guard count > 0 else {
            return TimeWindowStats(count: 0, elapsed: elapsed, highRatio: 0, lowRatio: 0, avgSimilarity: 0)
        }
        
        let highCount = similarityHistory.filter { $0.similarity >= successThreshold }.count
        let lowCount = similarityHistory.filter { $0.similarity < failureThreshold }.count
        let avgSimilarity = similarityHistory.map { $0.similarity }.reduce(0, +) / Float(count)
        
        return TimeWindowStats(
            count: count,
            elapsed: elapsed,
            highRatio: Float(highCount) / Float(count),
            lowRatio: Float(lowCount) / Float(count),
            avgSimilarity: avgSimilarity
        )
    }
    
    private func checkTimeWindowDecision() {
        guard !hasAutoDecided else { return }
        guard let startTime = comparisonStartTime else { return }
        
        let elapsed = Date().timeIntervalSince(startTime)
        
        // Only make decision after time window has passed
        guard elapsed >= timeWindowDuration else { return }
        guard similarityHistory.count >= 5 else { return }  // Need at least 5 samples
        
        guard let stats = getTimeWindowStats() else { return }
        
        // Decision logic:
        // Success: >= 60% of samples are >= 70% similarity
        // Failure: >= 60% of samples are < 65% similarity
        
        if stats.highRatio >= requiredRatio {
            // Auto success
            hasAutoDecided = true
            autoCompleteWithResult(success: true, avgSimilarity: stats.avgSimilarity)
        } else if stats.lowRatio >= requiredRatio {
            // Auto failure
            hasAutoDecided = true
            autoCompleteWithResult(success: false, avgSimilarity: stats.avgSimilarity)
        }
    }
    
    private func autoCompleteWithResult(success: Bool, avgSimilarity: Float) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let frame = self.latestFrame else { return }
            
            let result = FaceComparisonResult(
                isMatch: success,
                confidence: avgSimilarity,
                message: success ? 
                    "Face matched! Avg confidence: \(String(format: "%.1f", avgSimilarity * 100))%" :
                    "Face not matched. Avg confidence: \(String(format: "%.1f", avgSimilarity * 100))%"
            )
            
            self.captureSession?.stopRunning()
            self.onCapture?(frame, result)
            self.dismiss(animated: true)
        }
    }
    
    private func updateInstructionBasedOnTimeWindow() {
        guard let stats = getTimeWindowStats() else {
            instructionLabel.text = "Analyzing..."
            instructionLabel.textColor = .white
            return
        }
        
        let remainingTime = max(0, timeWindowDuration - stats.elapsed)
        
        if remainingTime > 0 {
            // Still collecting data
            if stats.highRatio >= 0.5 {
                instructionLabel.text = String(format: "Looking good! %.1fs...", remainingTime)
                instructionLabel.textColor = .green
            } else if stats.lowRatio >= 0.5 {
                instructionLabel.text = String(format: "Adjust position! %.1fs...", remainingTime)
                instructionLabel.textColor = .yellow
            } else {
                instructionLabel.text = String(format: "Keep steady... %.1fs", remainingTime)
                instructionLabel.textColor = .white
            }
        } else {
            // Time window complete, waiting for decision or manual confirm
            if stats.highRatio >= requiredRatio {
                instructionLabel.text = "✓ Match successful!"
                instructionLabel.textColor = .green
            } else if stats.lowRatio >= requiredRatio {
                instructionLabel.text = "✗ Match failed"
                instructionLabel.textColor = .red
            } else {
                instructionLabel.text = "Inconclusive - Tap to confirm"
                instructionLabel.textColor = .yellow
            }
        }
    }
}

// MARK: - AVCaptureVideoDataOutputSampleBufferDelegate
extension FaceCaptureViewController: AVCaptureVideoDataOutputSampleBufferDelegate {
    
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        // 防止处理过于频繁
        guard !isProcessing else { return }
        isProcessing = true
        
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            isProcessing = false
            return
        }
        
        // 转换为 UIImage
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let context = CIContext()
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
            isProcessing = false
            return
        }
        let currentFrame = UIImage(cgImage: cgImage)
        
        // 检测并比对人脸
        Task {
            await processFrame(currentFrame)
            isProcessing = false
        }
    }
    
    private func processFrame(_ frame: UIImage) async {
        guard let passportLm = passportLandmarks else {
            updateUI(similarity: 0, faceDetected: false, debugInfo: "Passport features not ready")
            return
        }
        
        // 检测当前帧中的人脸特征
        guard let cgImage = frame.cgImage else {
            updateUI(similarity: 0, faceDetected: false, debugInfo: "Frame conversion failed")
            return
        }
        
        let frameLandmarks: VNFaceLandmarks2D? = await withCheckedContinuation { continuation in
            let request = VNDetectFaceLandmarksRequest { request, error in
                guard error == nil,
                      let results = request.results as? [VNFaceObservation],
                      let face = results.first,
                      let landmarks = face.landmarks else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: landmarks)
            }
            
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
            } catch {
                continuation.resume(returning: nil)
            }
        }
        
        guard let currentLm = frameLandmarks else {
            updateUI(similarity: 0, faceDetected: false, debugInfo: "No face detected in current frame")
            return
        }
        
        // 比较特征点
        let similarity = compareLandmarks(passportLm, currentLm)
        
        // 构建调试信息 - 显示关键比例值
        let ratios1 = extractFaceRatios(passportLm)
        let ratios2 = extractFaceRatios(currentLm)
        var debugInfo = "Passport vs Current:\n"
        if ratios1.count >= 3 && ratios2.count >= 3 {
            debugInfo += String(format: "Eye distance: %.2f vs %.2f\n", ratios1[0], ratios2[0])
            debugInfo += String(format: "Nose-mouth: %.2f vs %.2f\n", ratios1[1], ratios2[1])
            debugInfo += String(format: "Eye-mouth: %.2f vs %.2f", ratios1[2], ratios2[2])
        }
        
        // 保存最新帧和结果
        latestFrame = frame
        let isMatch = similarity >= 0.6
        latestResult = FaceComparisonResult(
            isMatch: isMatch,
            confidence: similarity,
            message: isMatch ? "Face matched! Confidence: \(String(format: "%.1f", similarity * 100))%" : "Face not matched"
        )
        
        updateUI(similarity: similarity, faceDetected: true, debugInfo: debugInfo)
    }
    
    private func compareLandmarks(_ lm1: VNFaceLandmarks2D, _ lm2: VNFaceLandmarks2D) -> Float {
        // 使用面部几何比例特征进行比较
        // 这些比例对于每个人来说是相对独特的
        
        let ratios1 = extractFaceRatios(lm1)
        let ratios2 = extractFaceRatios(lm2)
        
        guard !ratios1.isEmpty && !ratios2.isEmpty && ratios1.count == ratios2.count else {
            return 0
        }
        
        // 计算各个比例的差异
        var totalDiff: Float = 0
        for i in 0..<ratios1.count {
            let diff = abs(ratios1[i] - ratios2[i])
            totalDiff += diff
        }
        
        let avgDiff = totalDiff / Float(ratios1.count)
        
        // 将差异转换为相似度 (差异越小，相似度越高)
        // 使用指数衰减：差异为0时相似度为1，差异越大相似度越低
        let similarity = exp(-avgDiff * 15) // 调整系数控制敏感度
        
        return similarity
    }
    
    /// 提取面部几何比例特征
    private func extractFaceRatios(_ landmarks: VNFaceLandmarks2D) -> [Float] {
        var ratios: [Float] = []
        
        guard let leftEye = landmarks.leftEye,
              let rightEye = landmarks.rightEye,
              let nose = landmarks.nose,
              let outerLips = landmarks.outerLips,
              let faceContour = landmarks.faceContour,
              let leftEyebrow = landmarks.leftEyebrow,
              let rightEyebrow = landmarks.rightEyebrow else {
            return []
        }
        
        // 计算关键点的中心
        let leftEyeCenter = centerOf(leftEye.normalizedPoints)
        let rightEyeCenter = centerOf(rightEye.normalizedPoints)
        let noseCenter = centerOf(nose.normalizedPoints)
        let mouthCenter = centerOf(outerLips.normalizedPoints)
        let leftEyebrowCenter = centerOf(leftEyebrow.normalizedPoints)
        let rightEyebrowCenter = centerOf(rightEyebrow.normalizedPoints)
        
        // 获取脸部轮廓的边界
        let facePoints = faceContour.normalizedPoints
        let faceWidth = facePoints.map { $0.x }.max()! - facePoints.map { $0.x }.min()!
        let faceHeight = facePoints.map { $0.y }.max()! - facePoints.map { $0.y }.min()!
        
        guard faceWidth > 0 && faceHeight > 0 else { return [] }
        
        // 1. 两眼间距 / 脸宽
        let eyeDistance = distance(leftEyeCenter, rightEyeCenter)
        ratios.append(Float(eyeDistance / faceWidth))
        
        // 2. 鼻子到嘴巴的距离 / 脸高
        let noseToMouth = distance(noseCenter, mouthCenter)
        ratios.append(Float(noseToMouth / faceHeight))
        
        // 3. 眼睛到嘴巴的距离 / 脸高
        let eyeMidpoint = CGPoint(x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
                                   y: (leftEyeCenter.y + rightEyeCenter.y) / 2)
        let eyeToMouth = distance(eyeMidpoint, mouthCenter)
        ratios.append(Float(eyeToMouth / faceHeight))
        
        // 4. 眼睛到鼻子的距离 / 脸高
        let eyeToNose = distance(eyeMidpoint, noseCenter)
        ratios.append(Float(eyeToNose / faceHeight))
        
        // 5. 左眼宽度 / 两眼间距
        let leftEyeWidth = eyeWidth(leftEye.normalizedPoints)
        ratios.append(Float(leftEyeWidth / eyeDistance))
        
        // 6. 右眼宽度 / 两眼间距
        let rightEyeWidth = eyeWidth(rightEye.normalizedPoints)
        ratios.append(Float(rightEyeWidth / eyeDistance))
        
        // 7. 嘴巴宽度 / 脸宽
        let mouthWidth = lipWidth(outerLips.normalizedPoints)
        ratios.append(Float(mouthWidth / faceWidth))
        
        // 8. 鼻子宽度 / 脸宽
        let noseWidth = self.noseWidth(nose.normalizedPoints)
        ratios.append(Float(noseWidth / faceWidth))
        
        // 9. 眉毛到眼睛的距离 / 脸高
        let leftBrowToEye = distance(leftEyebrowCenter, leftEyeCenter)
        ratios.append(Float(leftBrowToEye / faceHeight))
        
        // 10. 眉毛间距 / 脸宽
        let browDistance = distance(leftEyebrowCenter, rightEyebrowCenter)
        ratios.append(Float(browDistance / faceWidth))
        
        // 11. 脸的长宽比
        ratios.append(Float(faceHeight / faceWidth))
        
        // 12. 鼻子长度 / 脸高
        let noseLength = self.noseLength(nose.normalizedPoints)
        ratios.append(Float(noseLength / faceHeight))
        
        // 13. 眼睛Y位置 / 脸高 (眼睛在脸上的相对位置)
        let faceMinY = facePoints.map { $0.y }.min()!
        let eyeRelativeY = (eyeMidpoint.y - faceMinY) / faceHeight
        ratios.append(Float(eyeRelativeY))
        
        // 14. 嘴巴Y位置 / 脸高
        let mouthRelativeY = (mouthCenter.y - faceMinY) / faceHeight
        ratios.append(Float(mouthRelativeY))
        
        return ratios
    }
    
    private func centerOf(_ points: [CGPoint]) -> CGPoint {
        let sumX = points.map { $0.x }.reduce(0, +)
        let sumY = points.map { $0.y }.reduce(0, +)
        return CGPoint(x: sumX / CGFloat(points.count), y: sumY / CGFloat(points.count))
    }
    
    private func distance(_ p1: CGPoint, _ p2: CGPoint) -> CGFloat {
        return sqrt(pow(p1.x - p2.x, 2) + pow(p1.y - p2.y, 2))
    }
    
    private func eyeWidth(_ points: [CGPoint]) -> CGFloat {
        guard !points.isEmpty else { return 0 }
        let minX = points.map { $0.x }.min()!
        let maxX = points.map { $0.x }.max()!
        return maxX - minX
    }
    
    private func lipWidth(_ points: [CGPoint]) -> CGFloat {
        guard !points.isEmpty else { return 0 }
        let minX = points.map { $0.x }.min()!
        let maxX = points.map { $0.x }.max()!
        return maxX - minX
    }
    
    private func noseWidth(_ points: [CGPoint]) -> CGFloat {
        guard !points.isEmpty else { return 0 }
        let minX = points.map { $0.x }.min()!
        let maxX = points.map { $0.x }.max()!
        return maxX - minX
    }
    
    private func noseLength(_ points: [CGPoint]) -> CGFloat {
        guard !points.isEmpty else { return 0 }
        let minY = points.map { $0.y }.min()!
        let maxY = points.map { $0.y }.max()!
        return maxY - minY
    }
}
