# Everything ZK Verify

> 证明你是谁，但不暴露你是谁。

ZK-powered privacy verification + AI Agent matchmaking + privacy payment platform, built on **OKX Onchain OS**.

## What is this?

A platform where users can:

1. **ZK Verify** — Prove personal attributes (identity, health, age, education) via zero-knowledge proofs. Get verified on-chain without exposing any personal data.

2. **Agent Matchmaking** — AI Agent matches users based on verified ZK tags + conversation history + social signals. Supports dating, e-commerce, and social scenarios.

3. **Privacy Payment** — Pay gate fees or access paid content anonymously through escrow contracts with AI-powered arbitration.

## Architecture

```
Frontend/SDK  →  Agent Service  →  Smart Contracts (X Layer)
                     ↓
              Onchain OS Integration
```

- **Contracts**: `ZKVerifyRegistry`, `PrivacyEscrow`, `AnonymousContentAccess`
- **Agent**: Matchmaking engine, payment arbitrator, privacy gateway
- **SDK**: Client library for dApps to integrate

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your config

# Start the agent
npm run start

# Or run in dev mode
cd agent && npm run dev
```

## Project Structure

```
everything-zk-verify/
├── contracts/           # Solidity smart contracts (Foundry)
│   └── src/
│       ├── ZKVerifyRegistry.sol        # ZK tag management
│       ├── PrivacyEscrow.sol           # Escrow + arbitration
│       ├── AnonymousContentAccess.sol  # Anonymous paid content
│       └── interfaces/
├── agent/               # AI Agent service (Node.js/TypeScript)
│   └── src/
│       ├── services/
│       │   ├── matchmaking.ts    # AI matchmaking engine
│       │   ├── arbitration.ts    # Payment arbitration
│       │   ├── privacyGateway.ts # ZK verification gateway
│       │   ├── zkVerify.ts       # ZK proof operations
│       │   └── onchainOS.ts      # Onchain OS connector
│       └── config/
├── sdk/                 # Client SDK
│   └── src/
│       ├── lib/
│       │   ├── client.ts         # Core client
│       │   ├── payment.ts        # Privacy payment
│       │   └── anonymousAccess.ts # Anonymous content
│       └── types/
├── frontend/            # React frontend (coming soon)
├── DESIGN.md            # Full system design document
└── README.md
```

## Use Cases

### Dating with Privacy
- Verify your identity with ZK proof (face match)
- Set a gate fee to filter low-effort contacts
- Agent arbitrates: if valid conversation happens → fee goes to you; if ignored → auto refund

### Anonymous Content Access
- Pay to access someone's premium content
- Content creator gets paid but never knows who accessed it
- Nullifier prevents double-payment

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Smart Contracts | Solidity + Foundry |
| ZK Framework | Circom / snarkjs |
| Agent | Node.js + TypeScript |
| Chain | X Layer (OKX L2) |
| Platform | OKX Onchain OS |

## Team

Built for the OKX Internal Hackathon — Onchain OS: Start Building!

## License

MIT
