# x-social Design Spec

**Date:** 2026-04-20  
**Hackathon:** OKX Onchain OS Hackathon  
**Status:** Approved

---

## 1. Overview

x-social is a privacy-first social platform that gates entry with real-world identity verification. Users prove they are a real person via face comparison on iOS (Apple App Attest), receive an on-chain DID, then participate in anonymous social matching with built-in payments (MPP micro-payments and x402 standard payments) powered by OKX Onchain OS.

**Core user journey:**
```
iOS: face capture → FaceNet comparison → Apple App Attest signature
    ↓
Web: submit attestation → connect OKX Agentic Wallet → register on-chain DID
    ↓
Anonymous social matching (AI Agent)
    ↓
Social interactions with payments:
  - Messaging     → MPP  (< $1, instant auto-deduct)
  - Unlock content → x402 ($1–$50, PrivacyEscrow + Agent arbitration)
  - High-value     → ZK Privacy (> $50, hidden amounts)
```

---

## 2. Repo Structure

```
x-social/
├── ios/          # Face capture, FaceNet embedding, Apple App Attest
├── web/          # Next.js: attestation submission + social UI + payment modals
├── contracts/    # Solidity: ZKVerifyRegistry, PrivacyEscrow, AnonymousContentAccess, AgentRegistry8004
├── agent/        # Node.js: matchmaking engine, arbitration, OnchainOS connector, payment gateway
├── sdk/          # TypeScript client: payments, ZK verify, anonymous access
├── scripts/      # Python: attestation verification utilities
└── docs/         # Spec, pitch deck, architecture diagrams
```

---

## 3. Module Descriptions

### 3.1 ios/
Source: DIDBootloader iOS App (Swift/SwiftUI)

**Keep:**
- FaceNet face embedding and comparison (`FaceNetService.swift`)
- Apple App Attest (`AppAttestService.swift`)
- Face capture UI
- Attestation serialization and export (send to web via deep link or QR)

**Remove:**
- MRZ scanning (passport machine-readable zone)
- NFC passport reading
- All passport-related UI flows

**Output:** A signed attestation payload containing:
- Face embedding hash (not raw embedding)
- Device attestation certificate chain
- Timestamp + nonce

### 3.2 web/
Source: DIDBootloader Next.js + everything-zk-verify frontend

**Responsibilities:**
- Receive attestation from iOS (deep link / QR scan)
- Connect OKX Agentic Wallet (TEE-managed private key)
- Submit attestation to `ZKVerifyRegistry` → mint on-chain DID
- Social matching UI (browse profiles, send messages, unlock content)
- `PaymentModal` with tier routing: MPP / x402 / ZK Privacy

### 3.3 contracts/
Source: everything-zk-verify Solidity (Foundry), deployed on OKX X Layer

| Contract | Purpose |
|----------|---------|
| `ZKVerifyRegistry` | Store ZK identity tags as commitment hashes; accept face attestations as identity proofs |
| `PrivacyEscrow` | Gate-fee escrow with EIP-2612 Permit support; x402 entry point; Agent-triggered release |
| `AnonymousContentAccess` | Per-content payments with nullifier-based double-spend prevention |
| `AgentRegistry8004` | ERC-8004 Agent identity + multi-dimensional reputation scoring |

### 3.4 agent/
Source: everything-zk-verify Node.js service

**Services:**
- `matchmaking.ts` — anonymous profile matching engine
- `arbitration.ts` — evaluates escrow rules, triggers fund release/refund
- `onchainOS.ts` — OKX Onchain OS connector (Agentic Wallet, trading, payments)
- `privacyGateway.ts` — ZK proof generation gateway
- `zkVerification.ts` — verifies face attestations from iOS before DID registration

### 3.5 sdk/
Source: everything-zk-verify TypeScript SDK

- `payment.ts` — `createGateFee()`, `createContentPayment()`, `getDepositStatus()`
- `zkVerify.ts` — ZK tag registration and verification
- `anonymousAccess.ts` — content access with nullifier

### 3.6 scripts/
Source: DIDBootloader Python utilities

- `verify_attestation.py` — Apple App Attest certificate chain validation (for backend verification)

---

## 4. Payment Architecture

Three-tier payment system, automatically routed by amount:

| Tier | Protocol | Amount | Flow |
|------|----------|--------|------|
| Micro | MPP ⚡ | < $1 | Pre-loaded session balance, no confirmation, per-message deduct |
| Standard | x402 💳 | $1–$50 | HTTP 402 → Agentic Wallet Permit sign → `PrivacyEscrow.depositViaPermit()` → Agent release |
| Privacy | ZK 🛡️ | > $50 | Same as x402 + ZK amount hiding |

**x402 payment flow:**
```
Social action triggers HTTP 402
    → Agentic Wallet signs EIP-2612 Permit (zero gas for user)
    → Relayer submits depositViaPermit() on-chain
    → Funds locked in PrivacyEscrow
    → Platform Agent collects evidence (message logs, photo exchange, GPS checkin)
    → Agent calls releaseDeposit() or refundDeposit() based on rules
```

---

## 5. Identity Flow Detail

```
[iOS]
1. User opens camera → face captured
2. FaceNet generates 512-dim embedding
3. Embedding hash computed locally (raw embedding never leaves device)
4. Apple App Attest: device key signs (hash + nonce + timestamp)
5. Attestation payload exported (deep link to web app)

[Web]
6. Parse attestation payload
7. Connect OKX Agentic Wallet
8. Call agent/zkVerification: verify Apple cert chain + signature
9. Construct ZK commitment: H(face_hash, wallet_addr, salt)
10. Submit to ZKVerifyRegistry.registerTag(commitment, IDENTITY_TYPE)
11. DID registered on OKX X Layer

[Social]
12. User browses anonymous profiles (no PII exposed)
13. Match → initiate interaction with gate fee (x402)
14. Messaging via MPP micro-payments
15. Content unlock via AnonymousContentAccess
```

---

## 6. Integration Points (New Work Required)

These are the only new pieces of code needed to bridge the two projects:

1. **iOS attestation export format** — define JSON schema for the attestation payload sent from iOS to web
2. **`agent/zkVerification.ts`** — verify Apple App Attest cert chain server-side (reuse `scripts/verify_attestation.py` logic, port to TypeScript)
3. **`web/` attestation intake page** — new Next.js page to receive attestation from iOS deep link and trigger DID registration
4. **Remove NFC/MRZ from iOS** — delete passport-related Swift files

Everything else is direct file migration from the two source repos.

---

## 7. Out of Scope

- Passport NFC/MRZ scanning
- Desktop or Android client
- Cross-chain bridging
- Production security audit

---

## 8. Success Criteria (Hackathon Demo)

1. iOS face capture → attestation generated
2. Web receives attestation → DID registered on X Layer (visible on explorer)
3. Two test accounts match anonymously
4. MPP micro-payment deducted per message
5. x402 gate fee locked in escrow → auto-released after chat rule met
6. OKX Onchain OS Agentic Wallet signs all transactions
