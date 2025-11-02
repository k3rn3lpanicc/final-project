# Vote Encryption and Nullifier Check Implementation

## Overview
Implemented proper cryptographic encryption for vote submissions and added nullifier checks to prevent double voting.

## Changes Made

### 1. Vote Encryption (`frontend/src/encryption.ts`)

#### Previous Implementation
- Used simple Poseidon hash: `hash(optionIndex, nonce)`
- Not actual encryption, just hashing
- Could not be decrypted after election ends

#### New Implementation - ElGamal Encryption on Baby Jubjub Curve
- **Message Format**: `M = Poseidon(optionIndex, nonce)`
  - Combines vote option and random nonce into single field element
  - Nonce prevents linking multiple votes from same pattern

- **ElGamal Encryption Process**:
  1. Choose random ephemeral key `r`
  2. Compute `C1 = r * G` (ephemeral public key)
  3. Compute shared secret `S = r * PublicKey`
  4. Compute message point `M_G = M * G`
  5. Compute `C2 = M_G + S` (encrypted message)

- **Ciphertext Format**: `C1_x (32 bytes) || C1_y (32 bytes) || C2_x (32 bytes) || C2_y (32 bytes)`
  - Total: 128 bytes of encrypted data
  - Stored as hex string with `0x` prefix

- **Decryption** (when admin publishes private key after election):
  ```
  M_G = C2 - privKey * C1
  M = discrete_log(M_G)  // Solve to get original message
  (optionIndex, nonce) = preimage of M under Poseidon
  ```

### 2. Nullifier Check (`frontend/src/electionContract.ts`)

#### Added Pre-Submission Validation
Before submitting vote transaction:
1. Extract `nullifierHash` from public signals (index 1)
2. Extract `electionId` from public signals (index 2)
3. Call `contract.isNullifierUsed(electionId, nullifierHash)`
4. If already used, throw error: "You have already voted in this election!"

#### Benefits
- Prevents wasting gas on failed transactions
- Provides clear user feedback before signing transaction
- Catches double-vote attempts early in the process

### 3. Updated Main Application (`frontend/src/main.ts`)
- Changed `encryptVoteOption()` call to `await encryptVoteOption()` (now async)
- Maintains all existing functionality with proper encryption

## Security Properties

### Encryption Security
1. **Confidentiality**: Votes are encrypted using ElGamal with random ephemeral keys
2. **Verifiability**: After election, admin publishes private key for public verification
3. **Unlinkability**: Random nonce prevents linking encrypted votes
4. **Ballot Privacy**: Only ciphertext is stored on-chain, plaintext vote remains secret until decryption key is published

### Double Voting Prevention
1. **Nullifier Uniqueness**: Each credential generates unique nullifier per election
2. **On-chain Enforcement**: Smart contract tracks used nullifiers
3. **Pre-check**: Frontend validates before transaction to save gas
4. **Clear Feedback**: Users informed if they've already voted

## Technical Details

### Baby Jubjub Curve
- Used for EdDSA signatures and ElGamal encryption
- Field order: `21888242871839275222246405745257275088548364400416034343698204186575808495617`
- Curve order: `21888242871839275222246405745257275088614511777268538073601725287587578984328`
- Base point `G` coordinates are curve generator

### Public Key Format
- Public key is a point on Baby Jubjub: `(x, y)`
- Both coordinates are field elements (< field prime)
- Currently using fixed public key (placeholder)
- In production: fetch from election contract or backend API

### Integration with zkSNARK Circuit
The circuit already:
- Verifies EdDSA signature from admin
- Computes nullifier: `Poseidon(voterID, electionId, secretX)`
- Validates all signature components

The encryption happens **after** proof generation:
1. Generate proof with voter credentials
2. Select vote option
3. Encrypt vote option with election public key
4. Submit proof + encrypted vote to contract

## Testing Checklist
- [x] Build succeeds without errors
- [ ] Vote encryption produces 128-byte ciphertext
- [ ] Nullifier check prevents double voting
- [ ] Error message is user-friendly when already voted
- [ ] MetaMask integration works correctly
- [ ] Transaction submits successfully with encrypted vote
- [ ] On-chain verification passes

## Future Enhancements
1. Fetch election public key from contract/backend dynamically
2. Implement decryption utility for admins (after election ends)
3. Add vote counting tool using published private key
4. Support multiple encryption schemes (ElGamal, ECIES, etc.)
5. Optimize ciphertext size if needed

## Files Modified
1. `frontend/src/encryption.ts` - Implemented ElGamal encryption
2. `frontend/src/electionContract.ts` - Added nullifier pre-check
3. `frontend/src/main.ts` - Updated encryption call to async

## Dependencies
- `circomlibjs@0.1.7` - Baby Jubjub curve operations
- `poseidon-lite@0.3.0` - Poseidon hash function
- `ethers@6.15.0` - Ethereum interaction

---
**Date**: November 2, 2025
**Status**: ✅ Implementation Complete, Ready for Testing
