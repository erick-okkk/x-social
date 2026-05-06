# Railgun 隐私支付

X-Social 隐私支付模块，基于 [Railgun Privacy Protocol](https://railgun.org)，部署在本地 Hardhat 节点（demo 用）。

## 目录结构

```
railgun/
├── contract/          # Railgun 智能合约（来自 Railgun-Privacy/contract）
│   ├── contracts/     # Solidity 合约
│   ├── helpers/       # TypeScript 工具：Wallet / Note / MerkleTree / SNARK proof
│   ├── scripts/
│   │   └── demo.ts    # 完整演示脚本（shield → transfer → unshield）
│   ├── tasks/         # Hardhat 部署任务
│   ├── hardhat.config.ts
│   └── package.json
├── run.sh                        # 一键启动脚本
└── 0001-add-railgun-demo.patch   # OKX 添加的 demo 补丁
```

## 快速启动

```bash
cd railgun

# 首次运行：启动 Hardhat 节点 + 部署合约 + 跑 demo
bash run.sh
```

> **注意**：`run.sh` 会 clone `Railgun-Privacy/contract` 并 apply patch。
> 如果 `contract/` 目录已存在（当前已包含），直接进入 `contract/` 运行：

```bash
cd railgun/contract

# 安装依赖（需要 Node 20+）
npm install

# 启动本地节点
npx hardhat node &

# 部署合约
npx hardhat deploy:test --network localhost

# 跑完整 demo
npx hardhat run scripts/demo.ts --network localhost
```

## 与前端集成

前端隐私支付页（`web/src/pages/PrivacyPayPage.tsx`）通过 `server/` 目录的代理服务调用这里的合约：

```
前端 :5173  →  代理服务 :3001  →  Hardhat :8545  →  Railgun 合约
```

启动代理服务：

```bash
cd server
node index.js
```

## 隐私原理

| 步骤 | 链上可见 | 链上不可见 |
|------|---------|-----------|
| Shield | 某地址调用了 Railgun 合约 | 存入金额 |
| Transfer | 合约内部状态变化 | 发送方 / 接收方 / 金额 |
| Unshield | 某地址从 Railgun 提款 | 原始来源 / 金额 |

ZK-SNARK 证明（Groth16）确保转账有效性，同时对链上观察者完全隐藏。
