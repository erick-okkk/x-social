# FaceNet CoreML 转换脚本

将预训练的 FaceNet 模型转换为 CoreML 格式，用于 iOS 应用的人脸识别。

## 功能

- 下载预训练的 FaceNet 模型（VGGFace2）
- 使用 TorchScript 进行模型追踪
- 转换为 CoreML ML Program 格式
- 输出 512 维人脸嵌入向量

## 依赖

```bash
pip install torch coremltools facenet-pytorch numpy
```

## 使用方法

```bash
python convert_facenet.py
```

## 输出

- **路径**: `DateDate/ML/FaceNet.mlpackage`
- **输入**: 160×160 RGB 图像，归一化到 [-1, 1]
- **输出**: 512 维人脸嵌入向量

## 模型信息

| 属性 | 值 |
|------|-----|
| 训练数据集 | VGGFace2 |
| 输入尺寸 | 1×3×160×160 |
| 输出维度 | 512 |
| 最低部署目标 | iOS 15 |

## 在 iOS 中使用

```swift
// 加载模型
let model = try FaceNet(configuration: MLModelConfiguration())

// 预处理图像到 160x160，归一化到 [-1, 1]
let input = try FaceNetInput(input_image: pixelBuffer)

// 获取嵌入向量
let output = try model.prediction(input: input)
let embedding = output.embedding  // 512维向量

// 比较两个人脸（L2 距离）
let distance = zip(embedding1, embedding2).map { pow($0 - $1, 2) }.reduce(0, +).squareRoot()
let isSamePerson = distance < 1.0  // 阈值可调整
```

## 人脸比较阈值

- **L2 距离 < 1.0**: 同一人
- **余弦相似度 > 0.6**: 同一人

## 注意事项

1. 输入图像需要裁剪为仅包含人脸区域
2. 使用 Vision 框架的 `VNDetectFaceRectanglesRequest` 检测人脸
3. 确保人脸对齐以获得最佳效果
