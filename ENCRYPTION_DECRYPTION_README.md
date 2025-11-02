# Vote Decryption Tools

This directory contains tools for encrypting and decrypting votes in the zero-knowledge voting system.

## Files

- **`generate_keypair.js`** - Generates a new ElGamal key pair for election encryption
- **`decrypt_votes.js`** - Decrypts encrypted votes after the election ends
- **`frontend/src/encryption.ts`** - Frontend encryption utilities for voters

## Key Pair Management

### Generating a New Key Pair

When creating a new election, generate a fresh key pair:

```bash
node generate_keypair.js
```

This will output:
- Private key (keep secret until election ends)
- Public key (share with voters for encryption)

### Using the Key Pair

1. **During Election**: 
   - Share only the PUBLIC KEY with voters
   - Store private key securely (e.g., encrypted in database, hardware security module)
   - Voters encrypt their votes using the public key

2. **After Election Ends**:
   - Publish the PRIVATE KEY
   - Anyone can decrypt and verify all votes
   - This ensures transparency while maintaining voter privacy during voting

## Encryption Process

Votes are encrypted using ElGamal encryption on the Baby Jubjub elliptic curve:

1. Voter selects option index (e.g., 0, 1, 2...)
2. Generate random nonce for unlinkability
3. Create message: `M = poseidon2([optionIndex, nonce])`
4. Encrypt using ElGamal:
   - Choose random `r`
   - `C1 = r * G` (ephemeral public key)
   - `C2 = M * G + r * PubKey` (encrypted message)
5. Submit `C1 || C2` (128 bytes) to smart contract

## Decryption Process

After election ends, anyone with the private key can decrypt:

```bash
node decrypt_votes.js 0x<encryptedVote>
```

Example:
```bash
node decrypt_votes.js 0x1a2b3c4d...
```

The script will:
1. Verify the key pair is valid
2. Parse C1 and C2 from encrypted data
3. Calculate shared secret: `S = privKey * C1`
4. Recover message point: `M * G = C2 - S`
5. Solve discrete log to find `M`
6. Brute force to find `optionIndex` and `nonce` where `poseidon2([optionIndex, nonce]) = M`

### Decryption Limitations

- **Discrete Log**: The script brute forces the discrete log, which works for reasonable message values (< 1 million)
- **Poseidon Reversal**: After finding M, it brute forces optionIndex and nonce. This works for:
  - Small number of options (< 100)
  - Small nonce values (< 10,000)

For production with large nonces, consider:
- Storing nonce ranges with votes
- Using rainbow tables for faster reversal
- Or just revealing optionIndex directly (if nonce unlinkability is sufficient)

## Security Considerations

### During Election
- **Private key must remain secret** - Anyone with private key can decrypt all votes
- Store private key in secure environment (HSM, encrypted storage, multi-sig scheme)
- Use time-locked encryption or threshold cryptography for automatic release

### After Election
- **Publish private key** - Enables public verification of results
- Anyone can independently:
  - Decrypt all votes
  - Verify nullifiers prevent double voting
  - Verify zkSNARK proofs
  - Count votes and verify election outcome

## Integration with Smart Contract

The Election smart contract expects:
- `bytes encryptedVote` - 128 bytes (C1_x + C1_y + C2_x + C2_y, each 32 bytes)
- Contract stores encrypted votes on-chain
- After election, anyone can read events and decrypt using published private key

## Example Workflow

1. **Setup**:
   ```bash
   node generate_keypair.js
   # Update frontend/src/encryption.ts with public key
   # Store private key securely
   ```

2. **Voting** (Frontend):
   ```typescript
   import { encryptVoteOption } from './encryption';
   const { encryptedData } = await encryptVoteOption(optionIndex);
   await electionContract.submitVote(proof, encryptedData, nullifierHash);
   ```

3. **After Election** (Admin):
   ```bash
   # Publish private key
   # Voters/observers can decrypt
   node decrypt_votes.js 0x<vote1>
   node decrypt_votes.js 0x<vote2>
   # ... decrypt all votes
   ```

4. **Verification** (Anyone):
   - Fetch all Vote events from blockchain
   - Decrypt each vote using published private key
   - Verify zkSNARK proofs
   - Count votes and verify results

## Technical Details

- **Curve**: Baby Jubjub (alt_bn128 compatible)
- **Encryption**: ElGamal on elliptic curve
- **Hash**: Poseidon for message construction
- **Format**: 128 bytes (4 × 32-byte field elements)

## Future Improvements

- [ ] Optimize discrete log solving (baby-step giant-step algorithm)
- [ ] Add batch decryption script for all votes
- [ ] Implement threshold decryption (multiple trustees)
- [ ] Add time-locked encryption support
- [ ] Create verification dashboard showing decrypted results
