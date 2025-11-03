# Voting Results Dashboard

Real-time vote counting and visualization dashboard for blockchain-based elections with ECDH encryption.

## 📋 Overview

The Voting Results Dashboard is a web-based tool for election administrators to:
- Fetch encrypted votes from blockchain
- Decrypt votes in real-time with election private key
- Visualize vote distribution as counting progresses
- Export results for auditing
- Verify election integrity

**Key Feature**: Real-time UI updates during vote counting, not after completion!

## ✨ Features

### 🔐 Secure Decryption
- **ECDH Key Exchange**: Elliptic curve Diffie-Hellman on Baby Jubjub curve
- **AES-256-GCM**: Symmetric encryption for vote data
- **SHA-256**: Key derivation from shared secrets
- **Client-Side**: All decryption happens in browser (private key never sent to server)

### 📊 Real-Time Visualization
- **Live Progress Bar**: Shows blockchain scanning progress (blocks scanned / total blocks)
- **Dynamic Vote Distribution**: Updates as each chunk of votes is processed
- **Animated Charts**: Visual feedback with color-coded bars
- **Vote Statistics**: Valid votes, invalid votes, total processed

### ⚡ Optimized Performance
- **Chunked Blockchain Queries**: Fetches 2000 blocks at a time to avoid RPC limits
- **Batch Processing**: Processes votes efficiently with configurable delays
- **Auto-Detection**: Automatically finds contract deployment block
- **Smart Scanning**: Skips empty block ranges

### 💾 Export & Audit
- **JSON Export**: Download complete results including:
  - Vote counts per option
  - Timestamps
  - Transaction hashes
  - Decryption logs
- **Audit Trail**: Full transparency for verification

## 🚀 Setup

### Prerequisites

- Node.js v16+
- npm or yarn
- Access to blockchain RPC endpoint
- Election contract address and ID
- Election private key for decryption

### Installation

```bash
cd voting-dashboard
npm install
```

### Configuration

Default values are pre-filled for testing. Create `.env` file to customize:

```env
VITE_DEFAULT_CONTRACT=0x814E3417224f85C0c1508d17076447A1bC8a43b7
VITE_DEFAULT_ELECTION_ID=2
VITE_DEFAULT_PRIVATE_KEY=250082668618633646334213584719494925374420844776732603861415520274085646643
VITE_DEFAULT_RPC=https://mainnet.skalenodes.com/v1/honorable-steel-rasalhague
VITE_DEFAULT_START_BLOCK=35709656
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

### Quick Start

1. **Open Dashboard**: Navigate to `http://localhost:5173`
2. **Verify Configuration**: Fields are pre-filled with default test values
3. **Click "Start Counting"**: Begin real-time vote counting
4. **Watch Progress**:
   - Block scanning progress bar updates
   - Vote distribution builds up live
   - Vote counts increase in real-time
5. **View Results**: Final statistics and vote tallies
6. **Download Results**: Export as JSON for auditing

### Configuration Options

#### Contract Address
The deployed Election smart contract address.
- Example: `0x814E3417224f85C0c1508d17076447A1bC8a43b7`

#### Election ID
The specific election ID to count votes for.
- Type: Positive integer
- Example: `2`

#### Election Private Key
The private key used to decrypt votes (stays in browser).
- ⚠️ **Security**: Only use in secure environment
- Format: Decimal string (not hex)
- Example: `250082668618633646334213584719494925374420844776732603861415520274085646643`

#### RPC URL
The blockchain RPC endpoint.
- Mainnet: `https://bsc-dataseed.binance.org/`
- Testnet: `https://data-seed-prebsc-1-s1.binance.org:8545/`
- Skale: `https://mainnet.skalenodes.com/v1/honorable-steel-rasalhague`

#### Start Block (Optional)
Manual override for deployment block. Leave empty for auto-detection.
- Auto-detect: Faster, recommended
- Manual: Useful if auto-detect fails

## 🔧 How It Works

### 1. Connect to Blockchain
```
Provider connects to RPC endpoint
→ Verifies network connectivity
```

### 2. Auto-Detect Deployment Block
```
Binary search through blockchain
→ Finds first transaction to contract
→ Skips empty blocks before deployment
```

### 3. Fetch Vote Events
```
Query VoteSubmitted events in chunks:
├── Chunk 1: Blocks 35709656-35711655 (2000 blocks)
├── Chunk 2: Blocks 35711656-35713655 (2000 blocks)
├── ...
└── Chunk N: Remaining blocks

For each chunk:
  ├── Query events from blockchain
  ├── Parse encrypted vote data
  └── Move to next chunk
```

### 4. Decrypt Votes (Real-Time)
```
For each chunk with votes:
  For each vote:
    ├── Parse encrypted components (Rx, Ry, IV, ciphertext)
    ├── Compute shared secret: S = [privateKey] * R
    ├── Derive AES key: SHA256(sharedSecret.x)
    ├── Decrypt with AES-256-GCM
    ├── Parse plaintext: "optionIndex|nonce"
    ├── Update vote counts
    └── Update UI ← REAL-TIME UPDATE
  Wait 500ms (allow UI to repaint)
  Continue to next chunk
```

### 5. Display Results
```
Final statistics:
├── Total votes found
├── Valid votes counted
├── Invalid votes (decryption failed)
├── Vote distribution per option
└── Processing time
```

## 🔐 Encryption Details

### Vote Format

Encrypted vote structure (hex string):
```
Rx (64 chars) + Ry (64 chars) + IV (24 chars) + Ciphertext + Auth Tag
```

Example:
```
d8bb5652ac3b0d5e...  ← Rx (ephemeral public key X)
1d172f3f3515a8da...  ← Ry (ephemeral public key Y)
abc123def456...      ← IV (12 bytes for AES-GCM)
9876543210...        ← Encrypted vote + authentication tag
```

### Decryption Process

```typescript
// 1. Parse components
const rx = BigInt('0x' + hexData.slice(0, 64));
const ry = BigInt('0x' + hexData.slice(64, 128));
const iv = hexToBytes(hexData.slice(128, 152));
const ciphertext = hexToBytes(hexData.slice(152));

// 2. Compute shared secret (ECDH)
const R = [rx, ry]; // Ephemeral public key
const S = babyjub.mulPointEscalar(R, privateKey);
const sharedSecretX = BigInt(babyjub.F.toObject(S[0]));

// 3. Derive AES key
const aesKey = SHA256(sharedSecretX);

// 4. Decrypt with AES-256-GCM
const plaintext = await crypto.subtle.decrypt(
  { name: "AES-GCM", iv: iv },
  aesKey,
  ciphertext
);

// 5. Parse result
const [optionIndex, nonce] = plaintext.toString().split('|');
```

### Plaintext Format

Decrypted vote:
```
optionIndex|nonce
```

Example:
```
2|6155104926240914133
```

- `optionIndex`: Selected option (0, 1, 2, ...)
- `nonce`: Random value for uniqueness

## 📂 Project Structure

```
voting-dashboard/
├── src/
│   ├── main.js              # Application logic, UI updates
│   ├── voteCounter.js       # Vote counting engine
│   │   ├── connectBlockchain()
│   │   ├── detectDeploymentBlock()
│   │   ├── fetchEventsInChunks()
│   │   ├── decryptVote()
│   │   ├── processBatch()
│   │   └── countVotes() ← Main entry
│   └── style.css            # Dashboard styling
├── index.html               # Application layout
├── package.json             # Dependencies
├── vite.config.js           # Vite configuration
├── DEBUG_GUIDE.md           # Debugging reference
├── QUICKSTART.md            # Quick start guide
└── README.md                # This file
```

## 📊 Performance Metrics

### Test Election (6 Votes, ~40,000 Blocks)

| Metric | Time |
|--------|------|
| Total Time | 10-15 seconds |
| Block Scanning | 8-12 seconds |
| Vote Decryption | 1-2 seconds |
| UI Update Frequency | Every 500ms per chunk with votes |

### Scalability

- ✅ Handles thousands of votes
- ✅ Processes 20-100 votes per batch
- ✅ 2000 blocks per query chunk
- ✅ Adjustable delays for optimization

### RPC Limitations

Most RPC endpoints limit block queries:
- **Default**: 2000 blocks per query
- **Stricter networks**: Reduce to 1000 or 500
- **Error handling**: Automatic retry with smaller chunks

## 🔒 Security Considerations

### Private Key Handling
- ⚠️ Private key visible in browser input field
- ✅ Key never sent to any server
- ✅ All processing happens client-side
- ⚠️ For production: Use secure key management system

### Vote Privacy
- ✅ Votes remain encrypted on-chain forever
- ✅ Only admin with private key can decrypt
- ✅ Decryption only after election ends
- ✅ Results are verifiable by anyone once key is published

### Data Integrity
- ✅ Votes fetched from immutable blockchain
- ✅ zkSNARK proofs ensure only authorized voters
- ✅ Nullifiers prevent double voting
- ✅ Encryption prevents tampering

### Production Recommendations
1. **Hardware Security Module (HSM)** for private key storage
2. **Time-locked encryption** for automatic key release after election
3. **Multi-signature** for key access (requires multiple admins)
4. **Audit logs** for all decryption attempts
5. **Authentication** for dashboard access

## 🐛 Troubleshooting

### RPC Block Query Limit Errors

**Error**: `"Maximum allowed number of requested blocks is 2000"`

**Solution**: Dashboard automatically queries in 2000-block chunks. If error persists:
```javascript
// Edit src/voteCounter.js
const BLOCK_CHUNK_SIZE = 1000; // Reduce from 2000
```

### Connection Issues

**Symptoms**: Cannot connect to RPC, timeout errors

**Solutions**:
- Verify RPC URL is correct and accessible
- Check if blockchain node is running
- Test RPC with curl: `curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' <RPC_URL>`
- Try alternative RPC endpoints
- Check firewall/proxy settings

### Decryption Errors

**Symptoms**: "OperationError", invalid votes, wrong results

**Solutions**:
- Verify private key matches public key used for encryption
- Check election ID is correct
- Ensure votes were encrypted with matching public key
- Review vote format (must be valid hex)

### No Votes Found

**Symptoms**: "No valid votes found for this election"

**Solutions**:
- Verify contract address is correct
- Check election ID exists and is correct
- Ensure votes have been submitted
- Confirm connected to correct blockchain network
- Check if contract is deployed (auto-detect will fail otherwise)

### UI Not Updating in Real-Time

**Symptoms**: UI only updates at the end, no live progress

**Solutions**:
- Check browser console for JavaScript errors
- Verify `onUpdate` callback is being called (check console logs)
- Ensure browser is not throttling setTimeout
- Try smaller batch sizes in `voteCounter.js`
- Clear browser cache and reload

## 🛠️ Development

### Debug Mode

Enable verbose logging:
```javascript
// In src/voteCounter.js
const DEBUG = true; // Enable all console logs
```

Console log indicators:
- 🎬 Function entry points
- 📦 Chunk fetching progress
- 🔄 Vote processing status
- 🔥 Batch completion
- 📊 Vote counting updates
- ✅ Success confirmations
- ❌ Error messages

### Adjust Performance

```javascript
// In src/voteCounter.js

// Batch size (votes processed before UI update)
const BATCH_SIZE = 20; // Increase for better performance

// Delay between batches (ms)
const BATCH_DELAY = 500; // Reduce for faster counting

// Block chunk size (blocks queried at once)
const BLOCK_CHUNK_SIZE = 2000; // Adjust based on RPC limits
```

### Add Features

Common enhancements:
- Export to CSV/Excel
- Print-friendly report
- Vote timestamps
- Transaction links to block explorer
- Historical comparison
- Geographic visualization (if data available)

## 📄 License

MIT License

## 🆘 Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review [DEBUG_GUIDE.md](./DEBUG_GUIDE.md)
3. Check browser console for error messages
4. Verify RPC endpoint is working
5. Test with smaller block ranges first

---

**Version**: 1.0.0  
**Last Updated**: November 3, 2025  
**Status**: Production Ready
