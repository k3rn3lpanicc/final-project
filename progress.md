# VoteScheme Project Progress Report

## Project Overview

**VoteScheme** is a zero-knowledge proof-based anonymous voting system built using Circom circuits and zkSNARKs. The system enables voters to prove they are authorized to vote (by holding a valid credential signed by an issuer) without revealing their identity, while simultaneously preventing double-voting through cryptographic nullifiers.

### Core Components

1. **VoteScheme.circom** - Main circuit implementing:
   - EdDSA signature verification
   - Poseidon hash computations
   - Nullifier generation and verification

2. **get_input.js** - Input generation script that creates valid test inputs for the circuit

3. **compute_values.circom** - Helper circuit used to compute Poseidon hashes that match the main circuit's implementation

## Technical Architecture

### Circuit Design

The VoteScheme circuit verifies the following:

```
Inputs (Public):
- nh: nullifier hash = Poseidon(X, Xp, electionId)
- electionId: election context identifier
- A[256]: issuer's public key as 256-bit array

Inputs (Private):
- ID: voter identifier
- X, Xp: secret voter values
- R8[256], S[256]: EdDSA signature components

Output:
- valid: 1 if all constraints pass

Verification Logic:
1. Compute hashXp = Poseidon(Xp)
2. Compute msg = Poseidon(ID, X, hashXp)
3. Convert msg to 256 bits
4. Verify EdDSA signature: EdDSAVerifier(msg, R8, S, A)
5. Verify nullifier: Poseidon(X, Xp, electionId) === nh
```

### Cryptographic Primitives

- **Poseidon Hash**: Zero-knowledge friendly hash function
- **EdDSA**: Edwards-curve Digital Signature Algorithm (on Baby Jubjub curve)
- **BN128 Field**: Prime field with modulus 21888242871839275222246405745257275088548364400416034343698204186575808495617

## Work Summary

### Phase 1: Initial Setup and Analysis
- Examined existing circuit code and understood the voting scheme
- Identified that the circuit implements an anonymous credential system
- Circuit uses EdDSA signatures on Poseidon-hashed messages

### Phase 2: Circuit Fixes
**Problem**: The circuit was passing a field element directly to EdDSAVerifier, but the verifier expects bits.

**Solution**: 
- Added `include "circomlib/circuits/bitify.circom"`
- Converted message field element to 256 bits using `Num2Bits(256)`
- Updated EdDSAVerifier to accept 256 bits instead of 1 field element

```circom
component msg2bits = Num2Bits(256);
msg2bits.in <== msg;

component eddsa = EdDSAVerifier(256);
for (var i=0; i<256; i++) {
    eddsa.msg[i] <== msg2bits.out[i];
}
```

### Phase 3: Input Generation Issues
**Problem**: Generated inputs failed witness generation with "Assert Failed" errors.

**Root Cause Analysis**:
1. Some random values exceeded BN128 field modulus, causing modular reduction
2. More critically: **Poseidon implementation mismatch** between circomlibjs v0.1.7 and circomlib v2.0.5

### Phase 4: Poseidon Hash Mismatch Resolution
**Problem**: The Poseidon hash computed by circomlibjs JavaScript library produced different outputs than the Poseidon circuit in circomlib.

**Evidence**:
```
JavaScript circomlibjs Poseidon(Xp):  16403170040751689178581032341500349624147819147970814243609488289911566609388
Circuit circomlib v2 Poseidon(Xp):     5062018642126473091047304516208008570012259967526145982936060306396677630936
```

**Solution**:
Discovered that circomlibjs v0.1.7 is not compatible with circomlib v2.0.5. The solution is to use `poseidon-lite` npm package which correctly implements the Poseidon hash function matching circomlib v2:

```javascript
const { poseidon1, poseidon3 } = require('poseidon-lite');

// Now these match the circuit exactly
const hashXp = poseidon1([Xp]);
const msgField = poseidon3([ID, X, hashXp]);
const nullifier = poseidon3([X, Xp, electionId]);
```

This provides a pure JavaScript solution that can be used in frontend applications without needing to call circuits or generate witnesses.

### Phase 5: Field Boundary Validation
**Problem**: Random value generation could produce values ≥ BN128 field modulus.

**Solution**: Added field validation to `generateRandomBigInt()`:
```javascript
function generateRandomBigInt() {
    const BN128_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    let val;
    do {
        val = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
    } while (val >= BN128_FIELD);
    return val;
}
```

### Phase 6: Pure JavaScript Input Generation
Updated `get_input.js` to use `poseidon-lite` for all hash computations:
1. Generate random values within field bounds
2. Compute Poseidon hashes using `poseidon-lite` (matches circomlib v2)
3. Sign the computed message with EdDSA
4. Generate valid input.json with all components

**Key Achievement**: The input generation is now pure JavaScript with no dependency on running circuits or generating witnesses. This makes it suitable for frontend integration.

## Commands Reference

### Prerequisites

Install dependencies:
```bash
npm install
```

### Powers of Tau Ceremony (Trusted Setup)

If you need to generate new Powers of Tau files:

```bash
# Start a new Powers of Tau ceremony (replace 17 with desired power, 2^17 = 131,072 constraints)
snarkjs powersoftau new bn128 17 pot17_0000.ptau -v

# Contribute to the ceremony (adds entropy)
snarkjs powersoftau contribute pot17_0000.ptau pot17_0001.ptau --name="First contribution" -v

# Phase 2: Prepare for circuit-specific setup
snarkjs powersoftau prepare phase2 pot17_0001.ptau pot17_final.ptau -v

# Verify the Powers of Tau
snarkjs powersoftau verify pot17_final.ptau
```

**Note**: The power (17) must be large enough for your circuit:
- Circuit has ~20,097 constraints
- 2^17 = 131,072 constraints (sufficient)
- Use power 18 (2^18 = 262,144) or higher for safety margin

### Build and Compile

```bash
# Compile the VoteScheme circuit
.\circom.exe VoteScheme.circom --r1cs --wasm --sym -o build -l node_modules
```

This generates:
- `build/VoteScheme.r1cs` - R1CS constraint system
- `build/VoteScheme_js/VoteScheme.wasm` - WebAssembly witness generator
- `build/VoteScheme.sym` - Symbol file for debugging

### Generate zkSNARK Setup Keys

After compiling the circuit and having the Powers of Tau file:

```bash
# Generate the proving and verification keys
snarkjs groth16 setup build/VoteScheme.r1cs pot17_final.ptau VoteScheme_0000.zkey

# Contribute to phase 2 ceremony (circuit-specific)
snarkjs zkey contribute VoteScheme_0000.zkey VoteScheme_final.zkey --name="Circuit contribution" -v

# Verify the zkey
snarkjs zkey verify build/VoteScheme.r1cs pot17_final.ptau VoteScheme_final.zkey

# Export verification key
snarkjs zkey export verificationkey VoteScheme_final.zkey verification_key.json
```

### Generate Test Inputs

```bash
# Generate valid inputs for the circuit
node get_input.js
```

This creates `input.json` with all required fields:
- Public inputs: nh, electionId, A[256]
- Private inputs: ID, X, Xp, R8[256], S[256]

### Test the Circuit

Generate a witness to verify inputs are valid:

```bash
cd build\VoteScheme_js
node generate_witness.js VoteScheme.wasm ..\..\input.json witness.wtns
cd ..\..
```

If successful, the witness is generated without errors.

### Generate and Verify Proof

```bash
# Generate the proof
snarkjs groth16 prove VoteScheme_final.zkey build/VoteScheme_js/witness.wtns proof.json public.json

# Verify the proof
snarkjs groth16 verify verification_key.json public.json proof.json
```

If valid, you'll see: `[INFO]  snarkJS: OK!`

### Export Solidity Verifier

```bash
# Generate Solidity verifier contract
snarkjs zkey export solidityverifier VoteScheme_final.zkey VoteSchemeVerifier.sol
```

Deploy this contract to your blockchain to verify proofs on-chain.

### Complete Build and Test Flow

```bash
# 1. Install dependencies
npm install

# 2. Compile circuit
.\circom.exe VoteScheme.circom --r1cs --wasm --sym -o build -l node_modules

# 3. Setup trusted setup (if not already done)
snarkjs powersoftau new bn128 17 pot17_0000.ptau -v
snarkjs powersoftau contribute pot17_0000.ptau pot17_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 pot17_0001.ptau pot17_final.ptau -v

# 4. Generate circuit-specific keys
snarkjs groth16 setup build/VoteScheme.r1cs pot17_final.ptau VoteScheme_0000.zkey
snarkjs zkey contribute VoteScheme_0000.zkey VoteScheme_final.zkey --name="Circuit contribution" -v

# 5. Export verification key
snarkjs zkey export verificationkey VoteScheme_final.zkey verification_key.json

# 6. Generate test inputs
node get_input.js

# 7. Generate witness
cd build\VoteScheme_js
node generate_witness.js VoteScheme.wasm ..\..\input.json witness.wtns
cd ..\..

# 8. Generate proof
snarkjs groth16 prove VoteScheme_final.zkey build/VoteScheme_js/witness.wtns proof.json public.json

# 9. Verify proof
snarkjs groth16 verify verification_key.json public.json proof.json

# 10. Export Solidity verifier
snarkjs zkey export solidityverifier VoteScheme_final.zkey VoteSchemeVerifier.sol
```

## Technical Insights

### Key Learnings

1. **Library Compatibility**: circomlibjs v0.1.7 and circomlib v2.0.5 have incompatible Poseidon implementations. Use `poseidon-lite` npm package for correct v2 Poseidon hashes in JavaScript.

2. **Field Arithmetic**: All values in zkSNARK circuits operate modulo the field prime. Values must be validated before use to prevent unexpected behavior.

3. **Bit Representation**: EdDSA verifiers in Circom expect bit arrays, not field elements. The conversion must match exactly what was signed.

4. **Frontend-Ready Solution**: By using `poseidon-lite`, the input generation is pure JavaScript without needing to run circuits or generate witnesses, making it suitable for browser/frontend integration.

### Circuit Statistics

```
Template instances: 173
Non-linear constraints: 20,097
Linear constraints: 1,497
Public inputs: 258
Private inputs: 515
Wires: 22,344
```

## Dependencies

```json
{
  "dependencies": {
    "big-integer": "^1.6.52",
    "circomlib": "^2.0.5",
    "circomlibjs": "^0.1.7",
    "ffjavascript": "^0.2.57",
    "snarkjs": "^0.7.5",
    "poseidon-lite": "^0.3.0"
  }
}
```

**Note**: `circomlibjs` v0.1.7 has an incompatible Poseidon implementation with `circomlib` v2.0.5. We use `poseidon-lite` v0.3.0 which correctly implements the Poseidon hash matching circomlib v2.

## Project Structure

```
Project/
├── VoteScheme.circom          # Main voting circuit
├── get_input.js              # Input generation script (pure JS)
├── input.json                # Generated test inputs (gitignored)
├── package.json              # Node.js dependencies
├── package-lock.json         # Dependency lock file
├── circom.exe                # Circom compiler (Windows)
├── pot17_*.ptau              # Powers of Tau trusted setup files
├── build/
│   ├── VoteScheme.r1cs       # Compiled constraint system
│   ├── VoteScheme.sym        # Debug symbols
│   └── VoteScheme_js/        # WASM witness generator
│       └── VoteScheme.wasm
├── VoteScheme_final.zkey     # Circuit-specific proving key (generated)
├── verification_key.json     # Verification key (generated)
├── proof.json                # Generated proof (generated)
├── public.json               # Public inputs (generated)
├── VoteSchemeVerifier.sol    # Solidity verifier contract (generated)
├── README.md                 # Quick start guide
├── SOLUTION.md               # Solution explanation
└── progress.md               # This file - development history

Files marked (generated) are created during the build/proof generation process.
Files marked (gitignored) should not be committed to version control.
```

## Current Status

✅ **COMPLETE AND WORKING**

The circuit now successfully:
- Compiles without errors
- Accepts valid inputs
- Verifies EdDSA signatures correctly
- Validates nullifiers correctly
- Generates witnesses successfully
- Pure JavaScript input generation (frontend-ready)

All constraints are satisfied, and the system is ready for:
- Full zkSNARK proof generation
- Solidity verifier contract deployment
- Integration with smart contracts
- Frontend application development

## Next Steps (Future Work)

1. **Production Deployment**:
   - Perform multi-party Powers of Tau ceremony
   - Generate final production keys
   - Deploy Solidity verifier contract

2. **Frontend Integration**:
   - Build voter interface
   - Implement credential management
   - Add proof generation UI

3. **Backend Services**:
   - Credential issuance system
   - Election management
   - Result tallying

4. **Testing**:
   - Create comprehensive test suite
   - Security audit
   - Performance optimization

5. **Documentation**:
   - API documentation
   - Deployment guide
   - User manual

## Conclusion

This phase successfully resolved critical compatibility issues between JavaScript cryptographic libraries and Circom circuit implementations. The voting system now has a solid foundation with verified cryptographic components, ready for zkSNARK proof generation and deployment.

---

**Last Updated**: October 30, 2025  
**Status**: Phase 1 Complete ✅  
**Version**: 1.0.0  
**Next Milestone**: Production Trusted Setup & Deployment
