# Voter Dashboard

Web application for voters to register, generate zkSNARK proofs, and cast votes in the VoteScheme voting system.

## 📋 Overview

The Voter Dashboard is a browser-based interface that allows voters to:
- Register with personal documents
- Receive cryptographic credentials
- Generate zkSNARK proofs in the browser
- Cast encrypted votes to the blockchain
- View election results

## ✨ Features

### 🔐 Registration System
- Document upload (passport, photo)
- Automatic credential generation
- Secure storage of voter credentials
- Status tracking (pending, approved, rejected)

### 🧮 zkSNARK Proof Generation
- Browser-based proof generation (10-30 seconds)
- Uses snarkjs and circomlibjs
- No server-side processing
- Proof verification before submission

### 🔒 Vote Encryption
- ECDH + AES-256-GCM encryption
- Client-side encryption
- Vote privacy until election ends
- Secure key exchange with election public key

### 📊 Election Interface
- View active elections
- Browse election options
- Real-time vote submission
- Result viewing after election

### 💼 Credential Management
- Download credentials for backup
- Import existing credentials
- Credential validation
- Signature verification

## 🚀 Setup

### Prerequisites

- Node.js v16+
- npm or yarn
- MetaMask or Web3 wallet
- Backend API running

### Installation

```bash
cd frontend
npm install
```

### Configuration

Create `.env` file:

```env
VITE_API_URL=http://localhost:3000
VITE_ELECTION_CONTRACT_ADDRESS=0x...
VITE_BLOCKCHAIN_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
VITE_CHAIN_ID=97
```

### Start Development Server

```bash
npm run dev
```

Application available at `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## 📖 User Guide

### Step 1: Registration

1. Navigate to registration page
2. Fill in personal information:
   - Full name
   - Date of birth
   - Nationality
   - Email
3. Upload documents:
   - Passport image (front page)
   - Personal photo
4. Submit registration
5. Save your credentials (voterId, secretX, secretXp)

**Important**: Keep your credentials safe! You need them to vote.

### Step 2: Wait for Approval

1. Check registration status
2. Admin reviews your documents
3. Once approved, you receive a signature
4. You can now participate in elections

### Step 3: Vote

1. Connect your wallet (MetaMask)
2. Select an active election
3. Choose your preferred option
4. Click "Generate Proof" (takes 10-30 seconds)
5. Review proof details
6. Click "Submit Vote"
7. Confirm transaction in MetaMask
8. Wait for blockchain confirmation

### Step 4: Verify

1. Check transaction on block explorer
2. Verify your vote was recorded (encrypted)
3. View election results after voting ends

## 🔧 Technical Details

### Proof Generation Process

```typescript
1. Load voter credentials (voterId, secretX, secretXp)
2. Retrieve signature from backend (R8, S, A)
3. Compute Poseidon hashes:
   - hashXp = Poseidon(secretXp)
   - msg = Poseidon(voterId, secretX, hashXp)
4. Prepare circuit inputs:
   - Public: nullifier, electionId, issuer public key
   - Private: voterId, secretX, secretXp, signature
5. Generate witness using WASM circuit
6. Generate Groth16 proof using proving key
7. Extract proof components (a, b, c) and public signals
```

### Vote Encryption

```typescript
1. Generate random ephemeral key pair on Baby Jubjub
2. Compute shared secret via ECDH
3. Derive AES key from shared secret (SHA-256)
4. Encrypt vote plaintext with AES-256-GCM
5. Combine: R_x || R_y || IV || ciphertext
6. Submit to smart contract
```

### Circuit Files

Required files in `public/circuit/`:
- `VoteScheme.wasm` - Compiled circuit
- `VoteScheme_final.zkey` - Proving key (~50MB)
- `verification_key.json` - Verification key

These files are copied from the root project during build.

## 📂 Project Structure

```
frontend/
├── public/
│   ├── circuit/              # Circuit files
│   │   ├── VoteScheme.wasm
│   │   ├── VoteScheme_final.zkey
│   │   └── verification_key.json
│   └── assets/               # Images, fonts
├── src/
│   ├── components/           # React components
│   │   ├── Registration.tsx
│   │   ├── VotingInterface.tsx
│   │   ├── ProofGenerator.tsx
│   │   └── ElectionList.tsx
│   ├── utils/
│   │   ├── zkUtils.ts       # zkSNARK utilities
│   │   ├── crypto.ts        # Encryption functions
│   │   └── blockchain.ts    # Contract interaction
│   ├── services/
│   │   ├── api.ts           # Backend API calls
│   │   └── storage.ts       # Local storage
│   ├── types/               # TypeScript types
│   ├── App.tsx              # Main application
│   └── main.tsx             # Entry point
├── vite.config.ts           # Vite configuration
└── tsconfig.json            # TypeScript config
```

## 🔒 Security Considerations

### Private Key Management
- ⚠️ Credentials stored in browser localStorage
- ✅ Never sent to server except during registration
- ✅ User can download/backup credentials
- ⚠️ Clear browser data = lost credentials

### Proof Generation
- ✅ All proof generation happens client-side
- ✅ Private inputs never leave browser
- ✅ Only proof and public signals sent to blockchain
- ✅ Voter identity cryptographically hidden

### Vote Privacy
- ✅ Votes encrypted before submission
- ✅ Only election admin can decrypt
- ✅ Decryption happens after election ends
- ✅ Anyone can verify final tallies

### Recommendations for Production
1. **Credential Backup**: Implement secure backup mechanism
2. **Hardware Wallet**: Support hardware wallets for signing
3. **HTTPS**: Always use HTTPS in production
4. **Rate Limiting**: Prevent spam submissions
5. **Session Timeout**: Auto-logout after inactivity

## 🧪 Testing

### Run Tests

```bash
npm run test
```

### Test Proof Generation

```bash
npm run test:proof
```

### Test Encryption

```bash
npm run test:crypto
```

## 📊 Performance

### Proof Generation
- Time: 10-30 seconds (hardware dependent)
- Memory: ~500MB peak
- Browser requirements: WebAssembly support

### Vote Submission
- Gas cost: ~300,000 gas
- Transaction time: 3-15 seconds (network dependent)
- Confirmation: 1-5 blocks

### UI Responsiveness
- Initial load: <2 seconds
- Circuit loading: ~3 seconds
- Proof generation: Shows progress indicator
- Non-blocking UI during proof generation

## 🐛 Troubleshooting

### Proof Generation Fails
- Check circuit files are in `public/circuit/`
- Verify credentials are correct
- Ensure signature data is complete
- Check browser console for errors

### Transaction Rejected
- Verify wallet has sufficient balance
- Check election is active
- Ensure nullifier hasn't been used (no double voting)
- Verify network connection

### Wallet Connection Issues
- Install/enable MetaMask
- Switch to correct network (BSC Testnet)
- Refresh page and try again
- Check wallet permissions

### Credential Lost
- No recovery possible (by design for privacy)
- Re-register with new credentials
- Admin must approve new registration

## 🎨 Customization

### Styling

Edit `src/styles/` to customize:
- Colors and themes
- Layout and spacing
- Responsive breakpoints
- Component styles

### Configuration

Modify `vite.config.ts` for:
- Build optimization
- Environment variables
- Proxy settings
- Plugin configuration

## 🚀 Deployment

### Build

```bash
npm run build
```

Output in `dist/` folder.

### Deploy to CDN

```bash
# Upload dist/ to your CDN
aws s3 sync dist/ s3://your-bucket/ --acl public-read

# Or use Vercel/Netlify
vercel --prod
```

### Environment Setup

Set production environment variables:
- API URL
- Contract addresses
- RPC endpoints
- Chain IDs

## 📄 License

ISC License

## 🆘 Support

For voter dashboard issues:
- Check browser console for errors
- Verify wallet connection
- Ensure backend API is running
- Check circuit files are loaded
- Review transaction on block explorer
