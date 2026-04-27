import UIKit
import Vision

/// 人脸比对结果
struct FaceComparisonResult {
    let isMatch: Bool
    let confidence: Float
    let message: String
}

/// 人脸比对服务
class FaceComparisonService {
    
    /// 比较两张图片中的人脸
    /// - Parameters:
    ///   - passportImage: 护照中的照片
    ///   - capturedImage: 实时拍摄的照片
    /// - Returns: 比对结果
    static func compareFaces(passportImage: UIImage, capturedImage: UIImage) async -> FaceComparisonResult {
        
        // 1. 检测并裁剪护照照片中的人脸
        guard let passportFace = await detectAndCropFace(from: passportImage) else {
            return FaceComparisonResult(isMatch: false, confidence: 0, message: "Unable to detect face in passport photo")
        }
        
        // 2. 检测并裁剪拍摄照片中的人脸
        guard let capturedFace = await detectAndCropFace(from: capturedImage) else {
            return FaceComparisonResult(isMatch: false, confidence: 0, message: "Unable to detect face in captured photo")
        }
        
        // 3. 提取人脸特征并比较
        let similarity = await compareFaceFeatures(face1: passportFace, face2: capturedFace)
        
        // 4. 根据相似度判断是否匹配
        let threshold: Float = 0.6 // 相似度阈值
        let isMatch = similarity >= threshold
        
        let message = isMatch 
            ? "Face matched! Confidence: \(String(format: "%.1f", similarity * 100))%"
            : "Face not matched. Confidence: \(String(format: "%.1f", similarity * 100))%"
        
        return FaceComparisonResult(isMatch: isMatch, confidence: similarity, message: message)
    }
    
    /// 检测并裁剪图片中的人脸
    private static func detectAndCropFace(from image: UIImage) async -> UIImage? {
        guard let cgImage = image.cgImage else { return nil }
        
        return await withCheckedContinuation { continuation in
            let request = VNDetectFaceRectanglesRequest { request, error in
                guard error == nil,
                      let results = request.results as? [VNFaceObservation],
                      let face = results.first else {
                    continuation.resume(returning: nil)
                    return
                }
                
                // 将归一化坐标转换为图像坐标
                let imageWidth = CGFloat(cgImage.width)
                let imageHeight = CGFloat(cgImage.height)
                
                let faceRect = CGRect(
                    x: face.boundingBox.origin.x * imageWidth,
                    y: (1 - face.boundingBox.origin.y - face.boundingBox.height) * imageHeight,
                    width: face.boundingBox.width * imageWidth,
                    height: face.boundingBox.height * imageHeight
                )
                
                // 扩大裁剪区域，包含更多面部特征
                let expandedRect = faceRect.insetBy(dx: -faceRect.width * 0.2, dy: -faceRect.height * 0.2)
                let clampedRect = expandedRect.intersection(CGRect(x: 0, y: 0, width: imageWidth, height: imageHeight))
                
                // 裁剪人脸区域
                if let croppedCGImage = cgImage.cropping(to: clampedRect) {
                    let croppedImage = UIImage(cgImage: croppedCGImage)
                    continuation.resume(returning: croppedImage)
                } else {
                    continuation.resume(returning: nil)
                }
            }
            
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
            } catch {
                continuation.resume(returning: nil)
            }
        }
    }
    
    /// 比较两张人脸图片的特征相似度
    private static func compareFaceFeatures(face1: UIImage, face2: UIImage) async -> Float {
        // 使用 Vision 框架获取人脸特征点
        async let landmarks1 = getFaceLandmarks(from: face1)
        async let landmarks2 = getFaceLandmarks(from: face2)
        
        guard let lm1 = await landmarks1, let lm2 = await landmarks2 else {
            return 0
        }
        
        // 比较特征点的相似度
        return compareLandmarks(lm1, lm2)
    }
    
    /// 获取人脸特征点
    private static func getFaceLandmarks(from image: UIImage) async -> VNFaceLandmarks2D? {
        guard let cgImage = image.cgImage else { return nil }
        
        return await withCheckedContinuation { continuation in
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
    
    /// 比较两组人脸特征点
    private static func compareLandmarks(_ lm1: VNFaceLandmarks2D, _ lm2: VNFaceLandmarks2D) -> Float {
        var totalSimilarity: Float = 0
        var count: Float = 0
        
        // 比较各个特征区域
        if let leftEye1 = lm1.leftEye, let leftEye2 = lm2.leftEye {
            totalSimilarity += comparePoints(leftEye1.normalizedPoints, leftEye2.normalizedPoints)
            count += 1
        }
        
        if let rightEye1 = lm1.rightEye, let rightEye2 = lm2.rightEye {
            totalSimilarity += comparePoints(rightEye1.normalizedPoints, rightEye2.normalizedPoints)
            count += 1
        }
        
        if let nose1 = lm1.nose, let nose2 = lm2.nose {
            totalSimilarity += comparePoints(nose1.normalizedPoints, nose2.normalizedPoints)
            count += 1
        }
        
        if let outerLips1 = lm1.outerLips, let outerLips2 = lm2.outerLips {
            totalSimilarity += comparePoints(outerLips1.normalizedPoints, outerLips2.normalizedPoints)
            count += 1
        }
        
        if let faceContour1 = lm1.faceContour, let faceContour2 = lm2.faceContour {
            totalSimilarity += comparePoints(faceContour1.normalizedPoints, faceContour2.normalizedPoints)
            count += 1
        }
        
        if let leftEyebrow1 = lm1.leftEyebrow, let leftEyebrow2 = lm2.leftEyebrow {
            totalSimilarity += comparePoints(leftEyebrow1.normalizedPoints, leftEyebrow2.normalizedPoints)
            count += 1
        }
        
        if let rightEyebrow1 = lm1.rightEyebrow, let rightEyebrow2 = lm2.rightEyebrow {
            totalSimilarity += comparePoints(rightEyebrow1.normalizedPoints, rightEyebrow2.normalizedPoints)
            count += 1
        }
        
        return count > 0 ? totalSimilarity / count : 0
    }
    
    /// 比较两组特征点的相似度
    private static func comparePoints(_ points1: [CGPoint], _ points2: [CGPoint]) -> Float {
        // 计算点集的形状特征
        let shape1 = computeShapeDescriptor(points1)
        let shape2 = computeShapeDescriptor(points2)
        
        // 计算余弦相似度
        return cosineSimilarity(shape1, shape2)
    }
    
    /// 计算形状描述符
    private static func computeShapeDescriptor(_ points: [CGPoint]) -> [Float] {
        guard points.count >= 2 else { return [] }
        
        // 计算中心点
        let centerX = points.map { $0.x }.reduce(0, +) / CGFloat(points.count)
        let centerY = points.map { $0.y }.reduce(0, +) / CGFloat(points.count)
        
        // 计算相对于中心的归一化坐标
        var descriptor: [Float] = []
        for point in points {
            let dx = Float(point.x - centerX)
            let dy = Float(point.y - centerY)
            descriptor.append(dx)
            descriptor.append(dy)
        }
        
        // 归一化
        let magnitude = sqrt(descriptor.map { $0 * $0 }.reduce(0, +))
        if magnitude > 0 {
            descriptor = descriptor.map { $0 / magnitude }
        }
        
        return descriptor
    }
    
    /// 计算余弦相似度
    private static func cosineSimilarity(_ v1: [Float], _ v2: [Float]) -> Float {
        guard v1.count == v2.count && !v1.isEmpty else { return 0 }
        
        var dotProduct: Float = 0
        var norm1: Float = 0
        var norm2: Float = 0
        
        for i in 0..<v1.count {
            dotProduct += v1[i] * v2[i]
            norm1 += v1[i] * v1[i]
            norm2 += v2[i] * v2[i]
        }
        
        let denominator = sqrt(norm1) * sqrt(norm2)
        guard denominator > 0 else { return 0 }
        
        // 将余弦相似度从 [-1, 1] 映射到 [0, 1]
        return (dotProduct / denominator + 1) / 2
    }
}
