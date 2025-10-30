# zkSNARK Voting Frontend Demo

This is a demo frontend application that demonstrates generating and verifying zkSNARK proofs in the browser.

## Features

- ✅ Generate voter credentials (ID, X, Xp)
- ✅ Compute Poseidon hashes using poseidon-lite
- ✅ Generate EdDSA signatures
- ✅ Generate zkSNARK proofs using snarkjs
- ✅ Verify proofs locally before blockchain submission
- ✅ Download proof JSON for smart contract submission

## Setup

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npx vite
```

The application will be available at http://localhost:5173/

## Usage

1. **Generate Credentials**: Click the button to generate random voter credentials (ID, X, Xp)
2. **Generate Proof**: Creates a zkSNARK proof (takes 10-30 seconds)
3. **Verify Proof**: Verifies the proof locally using the verification key

## How It Works

### Step 1: Credential Generation
- Generates random values within the BN128 field
- Computes Poseidon hashes
- Creates EdDSA signature

### Step 2: Proof Generation
- Prepares circuit input from credentials
- Loads WASM circuit from `/public/circuit/VoteScheme.wasm`
- Generates witness and proof using the zkey file
- Returns proof and public signals

### Step 3: Local Verification
- Loads verification key
- Verifies proof matches public signals
- Shows whether vote would be accepted on-chain

## Files

- `src/zkUtils.ts` - Utility functions for zkSNARK operations
- `src/proofGenerator.ts` - Proof generation and verification
- `src/main.ts` - Main application logic and UI
- `public/circuit/` - Circuit files (WASM, zkey, verification key)

## Circuit Files Required

The following files must be in `public/circuit/`:

- `VoteScheme.wasm` - Compiled circuit
- `VoteScheme_final.zkey` - Proving key
- `verification_key.json` - Verification key

These are copied from the parent project's build output.

## Dependencies

- **vite**: Build tool and dev server
- **typescript**: Type safety
- **poseidon-lite**: Poseidon hash (compatible with circomlib v2)
- **circomlibjs**: EdDSA signatures and elliptic curve operations
- **snarkjs**: zkSNARK proof generation and verification

## Performance

- Credential generation: < 1 second
- Proof generation: 10-30 seconds (depends on hardware)
- Proof verification: < 1 second

## Browser Compatibility

Works in modern browsers that support:
- WebAssembly
- BigInt
- Crypto.getRandomValues

Tested on:
- Chrome 90+
- Firefox 90+
- Edge 90+
- Safari 14+

## Production Considerations

For production deployment:

1. **Issuer Private Key**: Should be server-side only, not in frontend
2. **Credential Issuance**: Implement proper authentication and credential distribution
3. **Circuit Files**: Host on CDN or optimize bundle size
4. **Error Handling**: Add better error messages and recovery
5. **Loading States**: Add progress indicators for long operations
6. **Smart Contract Integration**: Add web3 integration to submit proofs on-chain

## Security Notes

⚠️ **This is a demo application**. In production:

- Never expose issuer private keys in frontend code
- Implement proper authentication before credential issuance
- Use secure channels for credential distribution
- Validate all inputs
- Rate limit proof generation to prevent DoS
- Monitor for replay attacks using nullifiers

## License

GPL-3.0 (matching snarkjs and circom tools)
