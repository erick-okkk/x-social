# Everything ZK Verify - Frontend

A complete React + Vite + TypeScript frontend for the "Everything ZK Verify" project, featuring Web3 wallet integration, smart contract interaction, and ZK-based identity verification.

## Technology Stack

- **React 18.3** - UI framework
- **Vite 5.4** - Build tool & dev server
- **TypeScript 5.4** - Type safety
- **TailwindCSS 3** - Styling (via CDN)
- **ethers.js v6** - Blockchain interaction
- **React Router v6** - Routing

## Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable React components
│   │   ├── Navbar.tsx
│   │   ├── Layout.tsx
│   │   ├── ProfileCard.tsx
│   │   ├── TagBadge.tsx
│   │   ├── RuleDisplay.tsx
│   │   ├── PaymentModal.tsx
│   │   └── EscrowStatus.tsx
│   ├── pages/             # Page components
│   │   ├── DiscoveryPage.tsx    # Browse & search profiles
│   │   ├── ProfilePage.tsx      # View profile & initiate payment
│   │   ├── MyProfilePage.tsx    # Manage own profile
│   │   ├── RulesPage.tsx        # Create/manage rule sets
│   │   ├── ChatPage.tsx         # Chat with escrow tracking
│   │   └── WalletPage.tsx       # Wallet connection & commitment
│   ├── hooks/             # Custom React hooks
│   │   ├── useWallet.ts   # MetaMask connection
│   │   ├── useContracts.ts # Contract instances
│   │   ├── useEscrow.ts    # Escrow contract interactions
│   │   └── useZKRegistry.ts # ZK tag verification
│   ├── contracts/         # ABIs and contract addresses
│   │   ├── abis.ts        # Contract ABIs
│   │   └── addresses.ts   # Contract addresses (env-based)
│   ├── utils/             # Utility functions
│   │   ├── commitment.ts  # Generate identity commitments
│   │   └── format.ts      # Format addresses, amounts, dates
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx            # Main app with routes
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html             # HTML entry with TailwindCSS CDN
└── .env.example           # Environment variables template
```

## Features

### 1. Wallet Integration
- MetaMask connection with auto-detect
- Automatic network switching to X Layer (Chain ID: 196)
- Signer and provider management
- Wallet auto-reconnect on page load

### 2. Discovery & Profiles
- Search and browse verified profiles
- Profile cards showing:
  - Photo authenticity percentage
  - Verified ZK tags (Health, Education, Work, etc.)
  - Gate fee with reputation discounts
  - Rule set summary
- Detailed profile view with contact flow

### 3. ZK Verification
- View verified tags from ZK registry
- Identity commitment generation (Keccak-256)
- Tag verification status checking
- Support for multiple tag types

### 4. Escrow & Payments
- Create deposits with rule sets
- USDC Permit (EIP-2612) support
- ETH direct transfer option
- Reputation-based fee discounts
- Deposit tracking with status updates
- Rule completion progress tracking

### 5. Rules Management
- Create custom rule sets
- Define required and bonus rules:
  - CONVERSATION
  - PHOTO_EXCHANGE
  - CONTACT_SHARED
  - OFFLINE_AGREED
  - VIDEO_CALL
  - PAYMENT_TRANSFER
- Gate fee configuration
- Reputation scoring thresholds

### 6. Chat Interface
- Real-time messaging UI (mock data for MVP)
- Escrow status sidebar with rule tracking
- Action buttons (release/refund funds)
- Message history with timestamps

## Getting Started

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

### Development

```bash
# Start dev server (default: http://localhost:5173)
npm run dev
```

The dev server supports:
- Hot module replacement (HMR)
- Fast TypeScript compilation
- TailwindCSS auto-processing (via CDN)

### Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

Build output is in the `dist/` directory.

## Configuration

### Environment Variables

Create a `.env` file from `.env.example`:

```env
# Contract Addresses
VITE_ZK_REGISTRY=0x...        # ZK Verify Registry
VITE_ESCROW=0x...             # Privacy Escrow
VITE_CONTENT=0x...            # Anonymous Content Access
VITE_AGENT_REGISTRY=0x...     # Agent Registry (EIP-8004)
VITE_USDC=0x...               # USDC token address

# Network Configuration
VITE_CHAIN_ID=196             # X Layer chain ID
VITE_RPC_URL=https://rpc.xlayer.tech
```

## Contract Interfaces

### ZKVerifyRegistry
- `issueTag(commitment, tagType)` - Issue a verification tag
- `hasValidTag(commitment, tagType)` - Check tag validity
- `getUserTags(commitment)` - Get all tags for an identity

### PrivacyEscrow
- `createDeposit(recipient, ruleSetId, amount)` - Create escrow deposit
- `depositViaPermit(recipient, ruleSetId, amount, deadline, v, r, s)` - USDC Permit
- `releaseDeposit(depositId)` - Release funds to recipient
- `refundDeposit(depositId)` - Refund to depositor
- `getDeposit(depositId)` - Fetch deposit details
- `getRuleSet(ruleSetId)` - Fetch rule set
- `previewDepositAmount(commitment, ruleSetId)` - Preview with discount

### AnonymousContentAccess
- `publishContent(contentHash, accessLevel)` - Publish content
- `accessContent(contentId, proof)` - Access published content
- `verifyAccess(commitment, contentId)` - Verify access rights

### AgentRegistry (EIP-8004)
- `registerAgent(name, url)` - Register an agent
- `rateAgent(agentId, rating)` - Rate an agent
- `submitP2PFeedback(recipient, score, reason)` - Submit peer feedback
- `getP2PScore(commitment)` - Get reputation score

## Routing

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | DiscoveryPage | Browse profiles |
| `/profile/:id` | ProfilePage | View profile & pay |
| `/my-profile` | MyProfilePage | Manage own profile |
| `/rules` | RulesPage | Create rule sets |
| `/chat/:depositId` | ChatPage | Chat & escrow tracking |
| `/wallet` | WalletPage | Wallet connection |

## UI Design

- **Dark Theme**: Gray-900 background with purple/blue accents
- **Responsive**: Mobile-first design
- **Bilingual**: Chinese + English UI labels
- **No External UI Libraries**: Pure TailwindCSS + custom components

## Hooks Usage

### useWallet()
```typescript
const { address, signer, provider, chainId, connectWallet, disconnectWallet } = useWallet();
```

### useContracts()
```typescript
const contracts = useContracts(); // Returns { zkRegistry, escrow, content, agentRegistry }
```

### useEscrow()
```typescript
const {
  createDeposit,
  depositViaPermit,
  getDeposit,
  previewDepositAmount,
  releaseDeposit,
  refundDeposit,
  loading,
  error
} = useEscrow();
```

### useZKRegistry()
```typescript
const {
  hasValidTag,
  getUserTags,
  issueTag,
  loading,
  error
} = useZKRegistry();
```

## Mock Data

The MVP includes mock data for:
- 5 sample profiles with photos, tags, and rule sets
- Chat messages with timestamps
- Deposit tracking

Replace with real data by:
1. Connecting to contract read functions
2. Fetching from backend API
3. Using The Graph (if indexed)

## Development Notes

### Adding a New Page
1. Create component in `src/pages/`
2. Add route in `src/App.tsx`
3. Use `Layout` wrapper for consistent navigation

### Adding a New Component
1. Create in `src/components/`
2. Export from individual file
3. Import in pages/other components

### Working with Contracts
1. Define ABI in `src/contracts/abis.ts`
2. Create custom hook in `src/hooks/`
3. Use hook in pages/components

### Styling
- Use Tailwind classes throughout
- Dark theme palette:
  - Background: `bg-gray-900`
  - Cards: `bg-gray-800`
  - Borders: `border-gray-700`
  - Text: `text-white` / `text-gray-400`
  - Accents: `text-purple-400` / `text-blue-400`

## Security Considerations

- Wallet connection is non-custodial (MetaMask handles keys)
- No sensitive data stored in localStorage (use sessionStorage for temporary state)
- Contract addresses configurable via env variables
- Never include private keys in code

## Performance

- Code splitting via Vite
- Tree-shaking of unused code
- Lazy loading of pages (optional: add React.lazy())
- TailwindCSS CDN for reduced bundle size
- ethers.js v6 for smaller bundle than v5

## Browser Support

- Chrome/Chromium 88+
- Firefox 87+
- Safari 14+
- Edge 88+
- MetaMask required for Web3 features

## Troubleshooting

### "MetaMask not installed"
- Install MetaMask browser extension
- Ensure it's on X Layer network (Chain ID: 196)

### TypeScript errors on build
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript version: `npm list typescript`

### Build size too large
- TailwindCSS is loaded from CDN (not bundled)
- ethers.js is properly tree-shaken
- Check unused imports with `noUnusedLocals: true` in tsconfig.json

## Future Enhancements

- [ ] Real-time chat via WebSocket
- [ ] Image upload and storage
- [ ] Advanced filtering/sorting on discovery
- [ ] Payment history
- [ ] Notification system
- [ ] Dark/light theme toggle
- [ ] i18n for multiple languages
- [ ] Unit tests (Vitest)
- [ ] E2E tests (Playwright)
- [ ] Storybook component docs

## License

MIT
