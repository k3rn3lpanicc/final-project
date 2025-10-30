# VoteScheme - Anonymous Voting with zkSNARKs

A zero-knowledge proof voting system that enables anonymous yet verifiable voting using Circom circuits.

## Quick Start

### Installation

```bash
npm install
```

### Setup Powers of Tau (First Time Only)

If you don't have the Powers of Tau files, generate them:

```bash
# Generate Powers of Tau (takes a few minutes)
snarkjs powersoftau new bn128 17 pot17_0000.ptau -v
snarkjs powersoftau contribute pot17_0000.ptau pot17_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 pot17_0001.ptau pot17_final.ptau -v
```

Note: Power 17 = 2^17 = 131,072 constraints (sufficient for this circuit)

### Compile and Setup

```bash
# Compile the circuit
.\circom.exe VoteScheme.circom --r1cs --wasm --sym -o build -l node_modules

# Generate circuit-specific proving and verification keys
snarkjs groth16 setup build/VoteScheme.r1cs pot17_final.ptau VoteScheme_0000.zkey
snarkjs zkey contribute VoteScheme_0000.zkey VoteScheme_final.zkey --name="Contribution" -v
snarkjs zkey export verificationkey VoteScheme_final.zkey verification_key.json
```

### Generate and Verify Proof

```bash
# Generate test inputs
node get_input.js

# Create witness
cd build\VoteScheme_js
node generate_witness.js VoteScheme.wasm ..\..\input.json witness.wtns
cd ..\..

# Generate proof
snarkjs groth16 prove VoteScheme_final.zkey build/VoteScheme_js/witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify verification_key.json public.json proof.json
```

### Usage in Your Frontend

```javascript
const { poseidon1, poseidon3 } = require('poseidon-lite');
const circomlibjs = require('circomlibjs');

async function generateVoteCredential(voterId, secretX, secretXp, electionId, issuerPrivateKey) {
    const eddsa = await circomlibjs.buildEddsa();
    const babyjub = await circomlibjs.buildBabyjub();
    
    // Compute Poseidon hashes (matches circomlib v2)
    const hashXp = poseidon1([secretXp]);
    const msgField = poseidon3([voterId, secretX, hashXp]);
    
    // Sign the message
    const msgBytes = fieldToBytes32LE(msgField);
    const signature = eddsa.signPedersen(issuerPrivateKey, msgBytes);
    
    // Compute nullifier
    const nullifier = poseidon3([secretX, secretXp, electionId]);
    
    // Convert to circuit input format
    const A_bits = bytesToBits(babyjub.packPoint(eddsa.prv2pub(issuerPrivateKey)));
    const R8_bits = bytesToBits(babyjub.packPoint(signature.R8));
    const S_bits = bytesToBits(fieldToBytes32LE(signature.S));
    
    return {
        // Public inputs
        nh: nullifier.toString(),
        electionId: electionId.toString(),
        A: A_bits,
        // Private inputs (keep secret!)
        ID: voterId.toString(),
        X: secretX.toString(),
        Xp: secretXp.toString(),
        R8: R8_bits,
        S: S_bits
    };
}

// Helper functions
function fieldToBytes32LE(n) {
    let x = BigInt(n);
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = Number((x >> (8n * BigInt(i))) & 0xffn);
    return out;
}

function bytesToBits(bytes) {
    const bits = [];
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        for (let k = 0; k < 8; k++) bits.push((b >> k) & 1);
    }
    return bits;
}
```

## Generate Test Inputs

```bash
node get_input.js
```

This creates `input.json` with all required fields for testing the circuit.

### Deploy Solidity Verifier

```bash
# Export Solidity verifier contract
snarkjs zkey export solidityverifier VoteScheme_final.zkey VoteSchemeVerifier.sol
```

Deploy `VoteSchemeVerifier.sol` to your blockchain to verify proofs on-chain.

## Test the Circuit

```bash
# Compile circuit
.\circom.exe VoteScheme.circom --r1cs --wasm --sym -o build -l node_modules

# Generate witness (verifies inputs are valid)
cd build\VoteScheme_js
node generate_witness.js VoteScheme.wasm ..\..\input.json witness.wtns
cd ..\..
```

## Important Notes

### Library Compatibility

⚠️ **Critical**: `circomlibjs` v0.1.7 has an **incompatible Poseidon implementation** with `circomlib` v2.0.5.

✅ **Solution**: Use `poseidon-lite` npm package for Poseidon hashes in JavaScript:
- `poseidon1([value])` - for single input
- `poseidon3([a, b, c])` - for three inputs

### Field Constraints

All values must be within the BN128 field:
```javascript
const BN128_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
// Ensure: value < BN128_FIELD
```

## Circuit Inputs

### Public Inputs
- `nh`: nullifier hash (prevents double voting)
- `electionId`: election identifier
- `A[256]`: issuer's public key as bit array

### Private Inputs
- `ID`: voter identifier
- `X`, `Xp`: secret values
- `R8[256]`, `S[256]`: EdDSA signature components

## How It Works

1. **Credential Issuance**: Issuer signs `msg = Poseidon(ID, X, H(Xp))` with EdDSA
2. **Voting**: Voter generates zkSNARK proof with their credential
3. **Verification**: Circuit verifies:
   - EdDSA signature is valid
   - Nullifier matches `Poseidon(X, Xp, electionId)`
4. **Privacy**: Voter identity remains hidden, nullifier prevents double voting

## Dependencies

- `circomlib` ^2.0.5 - Circuit library
- `circomlibjs` ^0.1.7 - EdDSA and elliptic curve operations
- `poseidon-lite` ^0.3.0 - Poseidon hash (compatible with circomlib v2)
- `snarkjs` ^0.7.5 - zkSNARK proof generation
- `ffjavascript` ^0.2.57 - Finite field arithmetic

## Documentation

See `progress.md` for detailed technical documentation and development history.

## License

ISC
