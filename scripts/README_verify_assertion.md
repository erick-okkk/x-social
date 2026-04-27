# App Attest Assertion 验证脚本

验证 Apple App Attest 的 Assertion 签名，确保数据来自可信的 Secure Enclave (TEE)。

## 功能

- 解析 CBOR 格式的 Assertion 数据
- 验证 ECDSA 签名（EC P-256）
- 验证 counter 防重放攻击
- 支持 JSON 和 DER 格式的公钥

## 依赖

```bash
pip install cryptography cbor2
```

## 使用方法

### 验证签名
```bash
# 使用 JSON 公钥（verify_attestation.py 输出）
python verify_assertion.py --json signed_data.json --public-key public_key.json

# 使用 DER 公钥
python verify_assertion.py --json signed_data.json --public-key public_key.der

# 带 counter 验证
python verify_assertion.py --json signed_data.json --public-key public_key.json --counter 5
```

### 仅解析（不验证签名）
```bash
python verify_assertion.py --json signed_data.json --parse-only
```

## 输入文件格式

### signed_data.json
```json
{
  "payload": "要签名的原始数据（字符串或对象）",
  "assertion": "base64编码的assertion"
}
```

## 验证流程

```
1. 解码 base64 assertion
2. 解析 CBOR 格式，提取 authenticatorData 和 signature
3. 从 authenticatorData 提取:
   - rpIdHash (32 bytes): App ID 的 SHA256
   - flags (1 byte): 标志位
   - counter (4 bytes): 递增计数器
4. 计算 clientDataHash = SHA256(payload)
5. 构造签名消息 = authData || clientDataHash
6. 使用公钥验证 ECDSA 签名
7. 验证 counter > 上次存储的值
```

## 输出示例

```
📋 Parsed Assertion:
   RP ID Hash: a1b2c3d4...
   Flags: 0x01
   Counter: 7
   Signature length: 70 bytes

✅ Signature verification: VALID
   New counter: 7
```

## Counter 验证

Counter 用于防止重放攻击：
- 每次签名，counter 递增
- 服务端需存储每个 keyId 的最新 counter
- 验证时确保新 counter > 存储值

```bash
# 第一次验证（counter 未知）
python verify_assertion.py --json data1.json --public-key pk.json

# 后续验证（传入上次的 counter）
python verify_assertion.py --json data2.json --public-key pk.json --counter 7
```

## 公钥格式

### JSON 格式（推荐）
从 `verify_attestation.py` 输出，包含多种编码：
```json
{
  "keyId": "...",
  "publicKey": {
    "der": "hex编码的DER",
    "derB64": "base64编码的DER",
    ...
  }
}
```

### DER 格式
标准 SubjectPublicKeyInfo 二进制格式，可用 OpenSSL 生成/读取：
```bash
openssl ec -pubin -inform DER -in public_key.der -text -noout
```

## 完整工作流

```bash
# 服务端流程

# 1. 用户注册时，验证 attestation 并存储公钥和 keyId
python verify_attestation.py attestation.json --output keys/user123.json

# 2. 用户每次操作时，验证 assertion
python verify_assertion.py --json operation.json --public-key keys/user123.json --counter $LAST_COUNTER

# 3. 验证成功后，更新存储的 counter
```

## 安全注意事项

1. **存储公钥**: 每个 keyId 对应一个公钥，需持久化存储
2. **存储 counter**: 防止重放攻击，必须记录每个 keyId 的最新 counter
3. **验证 payload**: 确保 payload 与业务逻辑匹配
4. **验证 rpIdHash**: 确保请求来自正确的 App
