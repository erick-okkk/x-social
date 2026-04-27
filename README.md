# X-Social

> 真实身份 · 真实连接 · 链上信任
>
> Powered by OKX Onchain OS · Railgun · Apple App Attest

X-Social 是一个以人脸验证为入口的隐私社交平台。用户通过 iOS 端人脸比对（确保档案照片即本人真实长相），获得链上 DID，然后以匿名方式参与社交匹配，全程支付由 OKX Onchain OS 驱动。

## 核心流程

```
iOS：人脸比对 + Apple App Attest
    ↓
Web：连接 Agentic Wallet → 链上注册 DID（ZKVerifyRegistry）
    ↓
匿名社交匹配（AI Agent）
    ↓
社交互动 + 三级支付：
  - MPP   微支付（< $1，每条消息扣款）
  - x402  标准支付（$1–$50，PrivacyEscrow + Agent 仲裁）
  - ZK    隐私支付（> $50，Railgun Privacy Pool）
```

## 仓库结构

```
x-social/
├── ios/          # DIDBootloader iOS App（人脸比对 + Apple App Attest）
├── web/          # 前端（Vite + React，社交 UI + 支付弹窗 + 隐私支付页）
├── contracts/    # Solidity 合约（ZKVerifyRegistry / PrivacyEscrow / AgentRegistry8004）
├── agent/        # Node.js Agent 服务（撮合 / 仲裁 / OnchainOS connector）
├── sdk/          # TypeScript 客户端 SDK
├── server/       # Railgun 隐私支付代理服务（连接本地 Hardhat 节点）
├── scripts/      # Python 工具（Apple App Attest 证书链验证）
└── docs/         # 设计文档 + 黑客松材料
```

## 快速开始

### 1. 启动前端

```bash
cd web
npm install
npm run dev
# 打开 http://localhost:5173
```

### 2. 启动隐私支付（可选）

需要先跑起 Railgun 本地合约：

```bash
# 在 xlayer-toolkit/railgun-demo 分支下
cd /path/to/xlayer-toolkit/railgun
bash run.sh   # 启动 Hardhat 节点 + 部署 Railgun 合约
```

然后启动隐私支付代理：

```bash
cd server
npm install
node index.js
# 服务跑在 http://localhost:3001
```

访问 http://localhost:5173/privacy-pay?to=Alice&amount=50&service=设计咨询 即可演示完整 Railgun 隐私支付流程（真实链上 tx + ZK-SNARK proof）。

### 3. iOS App

用 Xcode 打开 `ios/DateDate.xcodeproj`，需要 iOS 15+。

## 技术栈

| 模块 | 技术 |
|------|------|
| iOS | Swift / SwiftUI / Core ML（FaceNet）/ Apple App Attest |
| Web | Vite + React 18 + TypeScript + Tailwind |
| 合约 | Solidity 0.8.24 / Foundry / OKX X Layer |
| Agent | Node.js + TypeScript |
| 隐私支付 | Railgun Privacy Pool + ZK-SNARK |
| 钱包 | OKX Onchain OS Agentic Wallet（TEE 私钥管理） |

## 文档

- 设计文档：`docs/superpowers/specs/2026-04-20-x-social-design.md`
- 原 zk-verify README：`README-zk-verify.md`
- 原 DIDBootloader README：`README-did.md`

## 黑客松

OKX Onchain OS Hackathon 参赛项目。
