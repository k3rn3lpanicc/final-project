# Quick Start: Update Contract Address

## Step 1: Deploy Contract

Deploy `VoteSchemeVerifier.sol` to BSC Testnet. Get the deployed contract address.

Example: `0x1234567890123456789012345678901234567890`

## Step 2: Update Frontend

Open `frontend/src/blockchainVerifier.ts` and find this line:

```typescript
const VERIFIER_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';
```

Replace with your deployed address:

```typescript
const VERIFIER_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';
```

## Step 3: Restart Dev Server

```bash
# If server is running, stop it (Ctrl+C)
# Then restart:
cd frontend
npx vite
```

## Step 4: Test

1. Open http://localhost:5173/
2. Install MetaMask if not already installed
3. Connect MetaMask to BSC Testnet
4. Generate credentials → Generate proof → Verify locally
5. Click "Verify Proof (On-Chain)"
6. MetaMask will connect (no transaction needed - it's a view call!)
7. See result!

## That's it!

The frontend will now verify proofs using your deployed smart contract on BSC Testnet.

## Troubleshooting

**Contract address still shows 0x000...000**
- Make sure you saved the file
- Restart the dev server
- Hard refresh browser (Ctrl+Shift+R)

**MetaMask not connecting**
- Check MetaMask is unlocked
- Try refreshing the page
- Check browser console for errors

**Verification fails**
- Ensure contract is deployed correctly
- Verify the contract address is correct
- Check you're on BSC Testnet
- Try generating a new proof
