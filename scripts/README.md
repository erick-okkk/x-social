# DateDate 辅助脚本

本目录包含 DateDate 应用的辅助工具脚本。

## 脚本列表

| 脚本 | 用途 |
|------|------|
| [convert_facenet.py](convert_facenet.py) | FaceNet 模型转换为 CoreML 格式 |
| [verify_attestation.py](verify_attestation.py) | 验证 App Attest Attestation 并提取公钥 |
| [verify_assertion.py](verify_assertion.py) | 验证 App Attest Assertion 签名 |

## 依赖安装

```bash
pip install cryptography cbor2 torch coremltools facenet-pytorch
```

## 快速使用

### 1. 转换 FaceNet 模型
```bash
python convert_facenet.py
```

### 2. 验证 Attestation 并导出公钥
```bash
python verify_attestation.py attestation.json --output public_key.json
```

### 3. 验证 Assertion 签名
```bash
python verify_assertion.py --json signed_data.json --public-key public_key.json
```

## 详细文档

每个脚本都有独立的 README：
- [FaceNet 转换说明](README_convert_facenet.md)
- [Attestation 验证说明](README_verify_attestation.md)
- [Assertion 验证说明](README_verify_assertion.md)
