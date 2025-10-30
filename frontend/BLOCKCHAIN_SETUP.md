# On-Chain Verification Setup

## Overview

The frontend now supports verifying zkSNARK proofs on the Binance Smart Chain (BSC) Testnet using your deployed Groth16Verifier contract.

## Setup Steps

### 1. Update Contract Address

Open `src/blockchainVerifier.ts` and update the contract address:

```typescript
const VERIFIER_CONTRACT_ADDRESS = '0xYourDeployedContractAddress';
```

Replace `0xYourDeployedContractAddress` with your actual deployed verifier contract address on BSC Testnet.

### 2. Install MetaMask

Users need MetaMask browser extension to interact with the blockchain:
- Install from: https://metamask.io
- Create/import a wallet
- Add BSC Testnet network (the app will auto-add it if needed)

### 3. Get Test BNB

To interact with BSC Testnet, users need test BNB:
- Visit: https://testnet.bnbchain.org/faucet-smart
- Connect wallet and request test BNB

## How It Works

### Workflow

1. **Generate Credentials** - Create voter credentials
2. **Generate Proof** - Create zkSNARK proof (10-30 seconds)
3. **Verify Locally** - Quick verification using verification key
4. **Verify On-Chain** - Call deployed smart contract on BSC Testnet

### On-Chain Verification Process

When user clicks "Verify Proof (On-Chain)":

1. **Connect Wallet** - MetaMask popup asks for permission
2. **Switch Network** - Auto-switches to BSC Testnet if needed
3. **Call Contract** - Calls `verifyProof()` on deployed verifier
4. **Display Result** - Shows success/failure with contract address link

### Contract Interaction

The app calls the Groth16Verifier contract:

```solidity
function verifyProof(
    uint[2] calldata _pA,
    uint[2][2] calldata _pB,
    uint[2] calldata _pC,
    uint[259] calldata _pubSignals
) public view returns (bool);
```

Since this is a `view` function, **no gas is required** - it's a free read operation!

## Network Configuration

### BSC Testnet Details

- **Chain ID**: 97
- **RPC URL**: https://data-seed-prebsc-1-s1.binance.org:8545/
- **Block Explorer**: https://testnet.bscscan.com
- **Currency**: tBNB (test BNB)

The app automatically configures these settings when connecting.

## Features

### Automatic Network Switching

If user is on the wrong network, the app will:
1. Try to switch to BSC Testnet
2. If network not added, add it to MetaMask
3. Then switch to it

### User-Friendly Feedback

- Real-time log messages show progress
- Success/error states with color coding
- Contract address links to BSC Testnet explorer
- MetaMask status detection on page load

### Security

- No private keys in frontend code
- Uses MetaMask for secure transaction signing
- View function calls (no state changes, no gas)
- All verification logic runs in smart contract

## Deployment

### 1. Deploy Verifier Contract

Deploy `VoteSchemeVerifier.sol` to BSC Testnet:

```bash
# Using Hardhat
npx hardhat run scripts/deploy.js --network bscTestnet

# Using Remix
# Copy contract to remix.ethereum.org and deploy
```

### 2. Update Frontend

Update contract address in `blockchainVerifier.ts`

### 3. Test

1. Open app in browser
2. Connect MetaMask
3. Generate credentials and proof
4. Verify locally first
5. Click "Verify On-Chain"
6. Confirm in MetaMask (if needed)
7. See result!

## Troubleshooting

### "MetaMask not detected"
- Install MetaMask extension
- Refresh page

### "Wrong network"
- App will auto-switch to BSC Testnet
- Or manually add BSC Testnet in MetaMask

### "Contract call failed"
- Check contract address is correct
- Ensure contract is deployed on BSC Testnet
- Verify contract is verified on BSCScan

### "Proof verification failed"
- Ensure local verification passed first
- Check proof was generated correctly
- Verify contract matches circuit

## Code Structure

```
frontend/src/
├── blockchainVerifier.ts    # On-chain verification logic
├── proofGenerator.ts         # Proof generation
├── zkUtils.ts                # zkSNARK utilities
└── main.ts                   # Main app logic
```

### Key Functions

**blockchainVerifier.ts**:
- `connectWallet()` - Connect MetaMask
- `verifyProofOnChain()` - Call verifier contract
- `isMetaMaskInstalled()` - Check for MetaMask
- `getVerifierContractAddress()` - Get contract address

**main.ts**:
- Handles UI interactions
- Coordinates proof generation and verification
- Displays results to user

## Resources

- **BSC Testnet Faucet**: https://testnet.bnbchain.org/faucet-smart
- **BSC Testnet Explorer**: https://testnet.bscscan.com
- **MetaMask**: https://metamask.io
- **Binance Docs**: https://docs.bnbchain.org

## Notes

- View function calls are **free** (no gas required)
- If you want to submit votes on-chain (state changes), you'll need actual test BNB
- The current setup only **verifies** proofs, doesn't record votes
- For a full voting system, create a VotingSystem contract that records votes

## Next Steps

1. Deploy VoteSchemeVerifier.sol to BSC Testnet
2. Update VERIFIER_CONTRACT_ADDRESS
3. Test with MetaMask
4. (Optional) Create full voting contract that records votes
5. (Optional) Deploy to BSC Mainnet for production
