# DateDate

护照 NFC 读取与人脸验证应用。

## 功能

- 📷 扫描护照 MRZ（机读区）
- 📱 通过 NFC 读取护照芯片数据
- 👤 实时人脸比对验证护照持有人

## 环境要求

- iOS 15.0+
- Xcode 15.0+
- Python 3.8+ (用于生成 ML 模型)
- 真机设备（NFC 和摄像头无法在模拟器使用）

## 安装步骤

### 1. 克隆仓库

```bash
git clone https://github.com/your-username/DateDate.git
cd DateDate
```

### 2. 生成 FaceNet CoreML 模型

由于模型文件较大，不包含在 Git 仓库中。请按以下步骤生成：

```bash
# 安装 Python 依赖
pip install torch facenet-pytorch coremltools numpy

# 运行转换脚本
python convert_facenet.py
```

这将在 `DateDate/ML/` 目录下生成 `FaceNet.mlpackage`。

### 3. 在 Xcode 中添加模型

1. 打开 `DateDate.xcodeproj`
2. 将 `DateDate/ML/FaceNet.mlpackage` 拖入 Xcode 项目导航器
3. 在弹出对话框中：
   - ✅ 勾选 "Copy items if needed"
   - ✅ 勾选目标 "DateDate"
4. 点击 "Finish"

### 4. 配置签名

1. 在 Xcode 中选择项目 → Signing & Capabilities
2. 选择你的开发团队
3. 确保已启用 "Near Field Communication Tag Reading"

### 5. 运行

在真机上构建并运行项目。

## 模型信息

| 属性 | 值 |
|------|-----|
| 模型 | FaceNet (InceptionResnetV1) |
| 预训练数据集 | VGGFace2 |
| 输入 | 160×160 RGB 图像，归一化到 [-1, 1] |
| 输出 | 512 维人脸嵌入向量 |
| 比较方法 | 余弦相似度 / 欧氏距离 |

## 项目结构

```
DateDate/
├── DateDate/
│   ├── ContentView.swift          # 主界面
│   ├── MRZScannerView.swift        # MRZ 扫描视图
│   ├── FaceCaptureView.swift       # 人脸拍摄视图
│   ├── FaceNetService.swift        # FaceNet 推理服务
│   ├── PassportUtils.swift         # MRZ 解析工具
│   ├── Info.plist                  # 权限配置
│   └── ML/
│       └── FaceNet.mlpackage       # CoreML 模型 (需生成)
├── convert_facenet.py              # 模型转换脚本
└── README.md
```

## 许可证

MIT License