# Quick Start Guide

## Prerequisites

- Node.js 18+ and npm
- MetaMask browser extension
- X Layer testnet setup in MetaMask

## 5-Minute Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your contract addresses
```

### 3. Start Dev Server
```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

## First Steps

1. **Connect Wallet** → Click "Connect Wallet" or go to `/wallet`
2. **Browse Profiles** → Explore the Discovery page with mock data
3. **View Profile** → Click any profile card for details
4. **Test Payment Flow** → Click "感兴趣 (Interested)" to see payment modal
5. **Manage Rules** → Visit `/rules` to create custom rule sets
6. **View Chat** → After payment, see chat interface with escrow tracking

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/App.tsx` | Route definitions & main app structure |
| `src/pages/*` | Page components for each route |
| `src/hooks/useWallet.ts` | MetaMask connection logic |
| `src/hooks/useEscrow.ts` | Escrow contract interactions |
| `src/contracts/addresses.ts` | Contract address configuration |
| `index.html` | TailwindCSS CDN import |

## Common Tasks

### Connect to Real Contracts
1. Update contract addresses in `.env`
2. Ensure ABIs in `src/contracts/abis.ts` match your contracts
3. Test contract calls in hooks

### Add a New Page
1. Create `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`:
```typescript
<Route path="/new-page" element={<Layout><NewPage /></Layout>} />
```
3. Link from navbar if needed

### Add Styling
- Use TailwindCSS classes directly in JSX
- Dark theme: `bg-gray-900`, `text-white`
- Accents: `text-purple-400`, `bg-purple-600`

### Debug Contract Calls
1. Check browser console for errors
2. Verify contract addresses match
3. Test ABI functions in ethers.js playground

## Build & Deploy

### Production Build
```bash
npm run build
```

Output in `dist/` directory. Deploy to:
- Vercel (recommended)
- Netlify
- GitHub Pages
- AWS S3 + CloudFront

### Environment for Production
```env
VITE_ZK_REGISTRY=0x... (mainnet address)
VITE_ESCROW=0x...
# ... etc
```

## Testing

The app includes mock data for MVP:
- 5 sample profiles
- Sample chat messages
- Test deposits

To use real data:
1. Replace mock arrays with contract calls
2. Update hooks to fetch from blockchain
3. Connect to backend API if needed

## Troubleshooting

### Port Already in Use
```bash
npm run dev -- --port 5174
```

### MetaMask Not Detected
- Refresh page after MetaMask installation
- Ensure you're on a supported network
- Check MetaMask is enabled

### Contract Calls Fail
- Verify addresses in `.env`
- Check ABI matches contract
- Ensure wallet has funds for gas
- Confirm you're on X Layer network

### Build Fails
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Next Steps

1. Replace mock data with real contract calls
2. Integrate backend API for chat/persistence
3. Add image upload functionality
4. Implement real-time updates (WebSocket/subscription)
5. Add unit & E2E tests
6. Deploy to production

## Resources

- [Vite Docs](https://vitejs.dev/)
- [React Docs](https://react.dev/)
- [ethers.js Docs](https://docs.ethers.org/)
- [TailwindCSS Docs](https://tailwindcss.com/)
- [X Layer Docs](https://www.xlayer.tech/)

## Support

For issues or questions:
1. Check browser console for errors
2. Verify environment variables
3. Test with mock data first
4. Check contract ABIs and addresses

Good luck building!
