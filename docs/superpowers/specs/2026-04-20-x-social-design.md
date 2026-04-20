# x-social 设计文档

**日期：** 2026-04-20  
**黑客松：** OKX Onchain OS Hackathon  
**状态：** 已审批

---

## 1. 项目概述

x-social 是一个以隐私为核心的社交平台，通过真实身份验证作为入口门槛。用户在 iOS 端完成人脸比对（Apple App Attest），获得链上 DID，然后以匿名方式参与社交匹配，全程支付由 OKX Onchain OS 驱动（MPP 微支付 + x402 标准支付）。

**核心用户流程：**
```
iOS：人脸采集 → FaceNet 比对 → Apple App Attest 签名
    ↓
Web：提交 attestation → 连接 OKX Agentic Wallet → 注册链上 DID
    ↓
匿名社交匹配（AI Agent 撮合）
    ↓
社交互动 + 支付：
  - 发消息       → MPP  （< $1，即时自动扣款）
  - 解锁内容     → x402 （$1–$50，PrivacyEscrow + Agent 仲裁）
  - 大额隐私交易 → ZK Privacy（> $50，金额隐藏）
```

---

## 2. Repo 结构

```
x-social/
├── ios/          # 人脸采集、FaceNet embedding、Apple App Attest
├── web/          # Next.js：attestation 提交 + 社交 UI + 支付弹窗
├── contracts/    # Solidity：ZKVerifyRegistry、PrivacyEscrow、AnonymousContentAccess、AgentRegistry8004
├── agent/        # Node.js：匹配引擎、仲裁、OnchainOS connector、支付网关
├── sdk/          # TypeScript 客户端：支付、ZK 验证、匿名内容访问
├── scripts/      # Python：attestation 验证工具
└── docs/         # 设计文档、pitch 材料、架构图
```

---

## 3. 模块说明

### 3.1 ios/
来源：DIDBootloader iOS App（Swift/SwiftUI）

**保留：**
- FaceNet 人脸 embedding 与比对（`FaceNetService.swift`）
- Apple App Attest（`AppAttestService.swift`）
- 人脸采集 UI
- Attestation 序列化与导出（通过 deep link 或 QR 码发送到 Web）

**删除：**
- MRZ 扫描（护照机读区）
- NFC 护照读取
- 所有护照相关 UI 流程

**输出：** 一个签名的 attestation payload，包含：
- 人脸 embedding 哈希（原始 embedding 不离开设备）
- 设备 attestation 证书链
- 时间戳 + nonce

### 3.2 web/
来源：DIDBootloader Next.js + everything-zk-verify 前端

**职责：**
- 接收来自 iOS 的 attestation（deep link / QR 扫描）
- 连接 OKX Agentic Wallet（TEE 管理的私钥）
- 提交 attestation 到 `ZKVerifyRegistry` → 铸造链上 DID
- 社交匹配 UI（浏览档案、发消息、解锁内容）
- `PaymentModal` 三级支付路由：MPP / x402 / ZK Privacy

### 3.3 contracts/
来源：everything-zk-verify Solidity（Foundry），部署在 OKX X Layer

| 合约 | 职责 |
|------|------|
| `ZKVerifyRegistry` | 以 commitment hash 存储 ZK 身份标签；接受人脸 attestation 作为身份证明 |
| `PrivacyEscrow` | 门槛费托管，支持 EIP-2612 Permit；x402 支付入口；Agent 触发释放 |
| `AnonymousContentAccess` | 按内容计费，nullifier 防止重复支付 |
| `AgentRegistry8004` | ERC-8004 Agent 身份注册 + 多维信誉评分 |

### 3.4 agent/
来源：everything-zk-verify Node.js 服务

**服务模块：**
- `matchmaking.ts` — 匿名档案匹配引擎
- `arbitration.ts` — 评估托管规则，触发资金释放或退款
- `onchainOS.ts` — OKX Onchain OS connector（Agentic Wallet、交易、支付）
- `privacyGateway.ts` — ZK 证明生成网关
- `zkVerification.ts` — 在 DID 注册前验证来自 iOS 的 face attestation

### 3.5 sdk/
来源：everything-zk-verify TypeScript SDK

- `payment.ts` — `createGateFee()`、`createContentPayment()`、`getDepositStatus()`
- `zkVerify.ts` — ZK 标签注册与验证
- `anonymousAccess.ts` — 带 nullifier 的内容访问

### 3.6 scripts/
来源：DIDBootloader Python 工具脚本

- `verify_attestation.py` — Apple App Attest 证书链验证（后端验证用）

---

## 4. 支付架构

三级支付体系，按金额自动路由：

| 级别 | 协议 | 金额 | 流程 |
|------|------|------|------|
| 微支付 | MPP ⚡ | < $1 | 预充值会话余额，无需确认，按消息扣款 |
| 标准 | x402 💳 | $1–$50 | HTTP 402 → Agentic Wallet Permit 签名 → `PrivacyEscrow.depositViaPermit()` → Agent 释放 |
| 隐私 | ZK 🛡️ | > $50 | 同 x402 + ZK 金额隐藏 |

**x402 支付流程：**
```
社交操作触发 HTTP 402
    → Agentic Wallet 签名 EIP-2612 Permit（用户零 gas）
    → Relayer 提交 depositViaPermit() 上链
    → 资金锁定在 PrivacyEscrow
    → Platform Agent 收集证据（消息记录、照片交换、GPS 签到等）
    → Agent 调用 releaseDeposit() 或 refundDeposit()
```

---

## 5. 身份流程详解

```
[iOS 端]
1. 用户打开摄像头 → 采集人脸
2. FaceNet 生成 512 维 embedding
3. 本地计算 embedding hash（原始 embedding 不离开设备）
4. Apple App Attest：设备密钥签名（hash + nonce + 时间戳）
5. 导出 attestation payload（deep link 跳转到 Web）

[Web 端]
6. 解析 attestation payload
7. 连接 OKX Agentic Wallet
8. 调用 agent/zkVerification：验证 Apple 证书链 + 签名
9. 构造 ZK commitment：H(face_hash, wallet_addr, salt)
10. 提交 ZKVerifyRegistry.registerTag(commitment, IDENTITY_TYPE)
11. DID 注册到 OKX X Layer

[社交端]
12. 用户浏览匿名档案（不暴露任何 PII）
13. 匹配 → 发起互动，缴纳门槛费（x402）
14. 通过 MPP 微支付发消息
15. 通过 AnonymousContentAccess 解锁内容
```

---

## 6. 集成点（新增工作）

两个项目合并后，仅需新增以下内容作为桥接：

1. **iOS attestation 导出格式** — 定义从 iOS 发往 Web 的 attestation payload JSON schema
2. **`agent/zkVerification.ts`** — 服务端验证 Apple App Attest 证书链（复用 `scripts/verify_attestation.py` 逻辑，移植为 TypeScript）
3. **`web/` attestation 接收页** — 新增 Next.js 页面，接收 iOS deep link 并触发 DID 注册
4. **iOS 删除 NFC/MRZ 代码** — 删除护照相关 Swift 文件

其余全部为文件搬移，无需修改逻辑。

---

## 7. 范围外

- 护照 NFC/MRZ 扫描
- 桌面端或 Android 客户端
- 跨链桥接
- 生产环境安全审计

---

## 8. 黑客松 Demo 成功标准

1. iOS 完成人脸采集 → 生成 attestation
2. Web 接收 attestation → DID 注册到 X Layer（链上浏览器可见）
3. 两个测试账户完成匿名匹配
4. MPP 按消息扣款正常工作
5. x402 门槛费锁定到 escrow → 满足聊天规则后自动释放
6. OKX Onchain OS Agentic Wallet 签署所有交易
