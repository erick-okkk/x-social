# App Attest Attestation 验证脚本

验证 Apple App Attest 的 Attestation 数据，提取并保存公钥用于后续 Assertion 验证。

## 功能

- 解析 CBOR 格式的 Attestation 数据
- 验证 Apple 证书链
- 验证 nonce（SHA256(authData || challenge)）
- 提取 EC P-256 公钥
- 输出 JSON 和 DER 格式的公钥

## 依赖

```bash
pip install cryptography cbor2
```

## 使用方法

### 从 JSON 文件读取
```bash
python verify_attestation.py attestation.json --output public_key.json
```

JSON 文件格式：
```json
{
  "attestation": "base64编码的attestation数据",
  "challenge": "base64编码的challenge",
  "teamId": "你的TeamID",
  "bundleId": "com.example.app",
  "environment": "dev"
}
```

### 命令行参数
```bash
python verify_attestation.py \
  --attestation "base64..." \
  --challenge "challenge字符串" \
  --team-id "TEAMID" \
  --bundle-id "com.example.app" \
  --env dev
```

## 输出文件

### public_key.json
```json
{
  "keyId": "base64编码的keyId",
  "keyIdHex": "hex编码的keyId",
  "publicKey": {
    "uncompressed": "04||X||Y (hex)",
    "uncompressedB64": "base64格式",
    "der": "DER编码 (hex)",
    "derB64": "DER编码 (base64)",
    "x": "X坐标 (hex)",
    "y": "Y坐标 (hex)",
    "xB64": "X坐标 (base64)",
    "yB64": "Y坐标 (base64)"
  }
}
```

### public_key.der
DER 编码的 SubjectPublicKeyInfo 二进制文件，可直接用于密码学库。

## 验证流程

```
1. 解码 base64 attestation
2. 解析 CBOR 格式
3. 提取证书链
4. 验证根证书是 Apple App Attest Root CA
5. 计算 nonce = SHA256(authData || SHA256(challenge))
6. 验证 nonce 存在于叶证书的 OID 扩展中
7. 从叶证书提取公钥
8. 验证 keyId = SHA256(公钥)
```

## App Attest 环境

| 环境 | App ID 格式 |
|------|-------------|
| `dev` | `TEAMID.bundleId` |
| `prod` | `TEAMID.bundleId` |

RP ID Hash = SHA256(App ID)

## 与 Assertion 验证配合

```bash
# 1. 验证 attestation，导出公钥
python verify_attestation.py attestation.json --output public_key.json

# 2. 使用公钥验证 assertion
python verify_assertion.py --json signed_data.json --public-key public_key.json
```

## 故障排除

### Nonce 验证失败
- 确保 challenge 是原始字节（如果是 base64，脚本会自动解码）
- 检查 nonce 计算方式：`SHA256(authData || challenge)`

### 证书链验证失败
- 确保在真机上测试（模拟器不支持 App Attest）
- 检查设备时间是否正确
