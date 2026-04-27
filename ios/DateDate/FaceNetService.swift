import Foundation
import UIKit
import Vision
import CoreML

/// FaceNet 人脸识别服务
/// 使用 512 维嵌入向量进行人脸比对
class FaceNetService {
    
    static let shared = FaceNetService()
    
    private var faceNetModel: FaceNet?
    private let modelQueue = DispatchQueue(label: "FaceNetModelQueue")
    private var modelLoaded = false
    
    // FaceNet 输入尺寸
    private let inputSize = 160
    
    private init() {
        loadModel()
    }
    
    private func loadModel() {
        modelQueue.async { [weak self] in
            do {
                let config = MLModelConfiguration()
                config.computeUnits = .cpuAndNeuralEngine
                
                self?.faceNetModel = try FaceNet(configuration: config)
                self?.modelLoaded = true
                print("FaceNet 模型加载成功")
            } catch {
                print("FaceNet 模型加载失败: \(error)")
            }
        }
    }
    
    var isModelLoaded: Bool {
        return modelLoaded && faceNetModel != nil
    }
    
    func extractEmbedding(from image: UIImage) async -> [Float]? {
        guard let cgImage = image.cgImage else {
            return nil
        }
        
        guard let faceImage = await detectAndCropFace(from: cgImage) else {
            return nil
        }
        
        guard let inputArray = preprocessImageToMultiArray(faceImage) else {
            return nil
        }
        
        return runFaceNet(input: inputArray)
    }
    
    func compareFaces(image1: UIImage, image2: UIImage) async -> FaceComparisonResult {
        async let embedding1Task = extractEmbedding(from: image1)
        async let embedding2Task = extractEmbedding(from: image2)
        
        guard let embedding1 = await embedding1Task,
              let embedding2 = await embedding2Task else {
            return FaceComparisonResult(
                isMatch: false,
                confidence: 0,
                message: "Unable to extract face features"
            )
        }
        
        let similarity = calculateSimilarity(embedding1, embedding2)
        let threshold: Float = 0.5
        let isMatch = similarity >= threshold
        
        return FaceComparisonResult(
            isMatch: isMatch,
            confidence: similarity,
            message: isMatch ?
                "Face matched! Confidence: \(String(format: "%.1f", similarity * 100))%" :
                "Face not matched. Similarity: \(String(format: "%.1f", similarity * 100))%"
        )
    }
    
    func compareWithEmbedding(
        precomputedEmbedding: [Float],
        newImage: UIImage
    ) async -> (similarity: Float, embedding: [Float]?) {
        guard let newEmbedding = await extractEmbedding(from: newImage) else {
            return (0, nil)
        }
        
        let similarity = calculateSimilarity(precomputedEmbedding, newEmbedding)
        return (similarity, newEmbedding)
    }
    
    private func calculateSimilarity(_ embedding1: [Float], _ embedding2: [Float]) -> Float {
        let cosSim = cosineSimilarity(embedding1, embedding2)
        let distance = euclideanDistance(embedding1, embedding2)
        let distanceBasedSimilarity = max(0, 1 - (distance / 2))
        return (cosSim + distanceBasedSimilarity) / 2
    }
    
    private func detectAndCropFace(from cgImage: CGImage) async -> CGImage? {
        return await withCheckedContinuation { continuation in
            let request = VNDetectFaceRectanglesRequest { request, error in
                guard error == nil,
                      let results = request.results as? [VNFaceObservation],
                      let face = results.first else {
                    continuation.resume(returning: nil)
                    return
                }
                
                let boundingBox = face.boundingBox
                let imageWidth = CGFloat(cgImage.width)
                let imageHeight = CGFloat(cgImage.height)
                
                var x = boundingBox.origin.x * imageWidth
                var y = (1 - boundingBox.origin.y - boundingBox.height) * imageHeight
                var width = boundingBox.width * imageWidth
                var height = boundingBox.height * imageHeight
                
                let padding = width * 0.2
                x = max(0, x - padding)
                y = max(0, y - padding)
                width = min(imageWidth - x, width + 2 * padding)
                height = min(imageHeight - y, height + 2 * padding)
                
                let faceRect = CGRect(x: x, y: y, width: width, height: height)
                guard let croppedImage = cgImage.cropping(to: faceRect) else {
                    continuation.resume(returning: nil)
                    return
                }
                
                continuation.resume(returning: croppedImage)
            }
            
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
            } catch {
                continuation.resume(returning: nil)
            }
        }
    }
    
    private func preprocessImageToMultiArray(_ cgImage: CGImage) -> MLMultiArray? {
        let size = inputSize
        let image = UIImage(cgImage: cgImage)
        
        UIGraphicsBeginImageContextWithOptions(CGSize(width: size, height: size), true, 1.0)
        image.draw(in: CGRect(x: 0, y: 0, width: size, height: size))
        guard let resizedImage = UIGraphicsGetImageFromCurrentImageContext() else {
            UIGraphicsEndImageContext()
            return nil
        }
        UIGraphicsEndImageContext()
        
        guard let resizedCGImage = resizedImage.cgImage else {
            return nil
        }
        
        let width = resizedCGImage.width
        let height = resizedCGImage.height
        let bytesPerPixel = 4
        let bytesPerRow = bytesPerPixel * width
        let bitsPerComponent = 8
        
        var pixelData = [UInt8](repeating: 0, count: width * height * bytesPerPixel)
        
        guard let context = CGContext(
            data: &pixelData,
            width: width,
            height: height,
            bitsPerComponent: bitsPerComponent,
            bytesPerRow: bytesPerRow,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return nil
        }
        
        context.draw(resizedCGImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        
        guard let multiArray = try? MLMultiArray(shape: [1, 3, NSNumber(value: size), NSNumber(value: size)], dataType: .float32) else {
            return nil
        }
        
        for y in 0..<size {
            for x in 0..<size {
                let pixelIndex = (y * width + x) * bytesPerPixel
                
                let r = Float(pixelData[pixelIndex]) / 127.5 - 1.0
                let g = Float(pixelData[pixelIndex + 1]) / 127.5 - 1.0
                let b = Float(pixelData[pixelIndex + 2]) / 127.5 - 1.0
                
                let rIndex = 0 * size * size + y * size + x
                let gIndex = 1 * size * size + y * size + x
                let bIndex = 2 * size * size + y * size + x
                
                multiArray[rIndex] = NSNumber(value: r)
                multiArray[gIndex] = NSNumber(value: g)
                multiArray[bIndex] = NSNumber(value: b)
            }
        }
        
        return multiArray
    }
    
    private func runFaceNet(input: MLMultiArray) -> [Float]? {
        guard let model = faceNetModel else {
            print("FaceNet 模型未加载")
            return nil
        }
        
        do {
            let output = try model.prediction(input_image: input)
            let embeddingArray = output.embedding
            
            var embedding: [Float] = []
            let count = embeddingArray.count
            for i in 0..<count {
                embedding.append(Float(truncating: embeddingArray[i]))
            }
            
            let norm = sqrt(embedding.reduce(0) { $0 + $1 * $1 })
            if norm > 0 {
                embedding = embedding.map { $0 / norm }
            }
            
            return embedding
        } catch {
            print("FaceNet 推理失败: \(error)")
            return nil
        }
    }
    
    private func cosineSimilarity(_ a: [Float], _ b: [Float]) -> Float {
        guard a.count == b.count, !a.isEmpty else { return 0 }
        
        var dotProduct: Float = 0
        var normA: Float = 0
        var normB: Float = 0
        
        for i in 0..<a.count {
            dotProduct += a[i] * b[i]
            normA += a[i] * a[i]
            normB += b[i] * b[i]
        }
        
        let denominator = sqrt(normA) * sqrt(normB)
        guard denominator > 0 else { return 0 }
        
        let similarity = (dotProduct / denominator + 1) / 2
        return similarity
    }
    
    private func euclideanDistance(_ a: [Float], _ b: [Float]) -> Float {
        guard a.count == b.count, !a.isEmpty else { return Float.infinity }
        
        var sum: Float = 0
        for i in 0..<a.count {
            let diff = a[i] - b[i]
            sum += diff * diff
        }
        
        return sqrt(sum)
    }
}
