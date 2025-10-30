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
JavaScript Poseidon(Xp):  16403170040751689178581032341500349624147819147970814243609488289911566609388
Circuit Poseidon(Xp):      5972441635514246144761410209880268220067336074491674653770762422110656482285
```

**Solution**:
Created a helper circuit (`compute_values.circom`) that computes all Poseidon hashes:
- Runs the circuit to generate a witness
- Extracts the correct hash values from the witness
- Uses these values for signature generation

This ensures JavaScript and circuit computations match exactly.

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

### Phase 6: Complete Input Generation Workflow
Updated `get_input.js` to:
1. Generate random values within field bounds
2. Write temporary input file for compute_values circuit
3. Execute circuit to compute Poseidon hashes
4. Read witness to extract hash values
5. Sign the circuit-computed message with EdDSA
6. Generate valid input.json with all components

## Commands Reference

### Build and Compile

```bash
# Compile the main VoteScheme circuit
.\circom.exe VoteScheme.circom --r1cs --wasm --sym -o build -l node_modules

# Compile the helper circuit (required for input generation)
.\circom.exe compute_values.circom --r1cs --wasm --sym -o build -l node_modules
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

```bash
# Generate witness to verify inputs are valid
cd build\VoteScheme_js
node generate_witness.js VoteScheme.wasm ..\..\input.json witness.wtns
```

If successful, the witness is generated without errors, proving all constraints are satisfied.

### Complete Build and Test Flow

```bash
# Full workflow from scratch
.\circom.exe VoteScheme.circom --r1cs --wasm --sym -o build -l node_modules
.\circom.exe compute_values.circom --r1cs --wasm --sym -o build -l node_modules
node get_input.js
cd build\VoteScheme_js
node generate_witness.js VoteScheme.wasm ..\..\input.json witness.wtns
```

## Technical Insights

### Key Learnings

1. **Library Compatibility**: Different versions of circomlib and circomlibjs may implement cryptographic primitives differently. Always verify hash outputs match between JS and circuits.

2. **Field Arithmetic**: All values in zkSNARK circuits operate modulo the field prime. Values must be validated before use to prevent unexpected behavior.

3. **Bit Representation**: EdDSA verifiers in Circom expect bit arrays, not field elements. The conversion must match exactly what was signed.

4. **Witness-Based Validation**: When JS library implementations don't match circuit implementations, use the circuit itself as the source of truth by extracting values from witnesses.

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
    "snarkjs": "^0.7.5"
  }
}
```

## Project Structure

```
Project/
├── VoteScheme.circom          # Main voting circuit
├── compute_values.circom      # Helper circuit for Poseidon computation
├── get_input.js              # Input generation script
├── input.json                # Generated test inputs
├── build/
│   ├── VoteScheme_js/        # Compiled main circuit
│   └── compute_values_js/    # Compiled helper circuit
├── circom.exe                # Circom compiler
├── node_modules/             # Dependencies
└── pot17_*.ptau             # Powers of Tau trusted setup files
```

## Current Status

✅ **COMPLETE AND WORKING**

The circuit now successfully:
- Compiles without errors
- Accepts valid inputs
- Verifies EdDSA signatures correctly
- Validates nullifiers correctly
- Generates witnesses successfully

All constraints are satisfied, and the system is ready for:
- Full zkSNARK proof generation
- Integration with smart contracts
- Frontend application development

## Next Steps (Future Work)

1. **Generate zkSNARK Proofs**: Use snarkjs to generate full zero-knowledge proofs
2. **Trusted Setup**: Perform ceremony for production deployment
3. **Smart Contract**: Deploy Solidity verifier contract
4. **Voter Registration**: Implement credential issuance system
5. **Frontend**: Build user interface for voting
6. **Testing**: Create comprehensive test suite
7. **Documentation**: Add API documentation and usage examples

## Conclusion

This phase successfully resolved critical compatibility issues between JavaScript cryptographic libraries and Circom circuit implementations. The voting system now has a solid foundation with verified cryptographic components, ready for zkSNARK proof generation and deployment.

---

**Date**: October 30, 2025  
**Status**: Phase 1 Complete ✅  
**Next Milestone**: zkSNARK Proof Generation
