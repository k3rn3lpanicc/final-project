# Voting Results Dashboard

A web-based dashboard for counting and visualizing election results from blockchain-based voting systems.

## Features

- 🔐 **Secure Vote Decryption**: Uses ECDH + AES-GCM encryption to decrypt votes
- 📊 **Real-time Progress**: Live progress tracking with processing statistics
- 📈 **Visual Results**: Interactive bar charts showing vote distribution
- ⚡ **Fast Processing**: Batch processing for handling large numbers of votes
- 🎯 **Smart Scanning**: Auto-detects contract deployment block (skips empty blocks)
- 🔍 **Chunked Queries**: Handles RPC limits by querying in chunks
- 💾 **Export Results**: Download complete results as JSON
- 🎨 **Modern UI**: Clean, responsive interface with dark theme

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Access to an Ethereum RPC endpoint (local or remote)
- Election contract address and ID
- Election private key for decryption

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

1. **Open the Dashboard**: Navigate to `http://localhost:5173` (or the URL shown in terminal)

2. **Enter Election Details**:
   - **Contract Address**: The deployed Election smart contract address (e.g., `0x1234...`)
   - **Election ID**: The specific election ID to count votes for
   - **Private Key**: The election private key used to decrypt votes (stays in browser)
   - **RPC URL**: The blockchain RPC endpoint (default: `http://127.0.0.1:8545/`)

3. **Start Counting**: Click "Start Counting" to begin processing votes

4. **View Results**: See real-time progress and final vote distribution

5. **Export Data**: Download the complete results as JSON for further analysis

## Security Notes

⚠️ **IMPORTANT**: The private key is only used in your browser and is never sent to any server. However:

- Only use this dashboard in a secure environment
- Never share your election private key
- Clear your browser cache after use if using a shared computer
- Use HTTPS in production environments

## How It Works

1. **Connects to Blockchain**: Establishes connection to the Ethereum network via RPC
2. **Detects Deployment**: Auto-detects contract deployment block using binary search
3. **Fetches Vote Events**: Queries `VoteSubmitted` events from deployment block onwards
4. **Decrypts Votes**: Uses ECDH to derive shared secrets and AES-GCM to decrypt each vote
5. **Counts Results**: Aggregates votes by option and tracks invalid votes
6. **Displays Results**: Shows interactive visualizations and detailed statistics

## Technical Details

### Encryption Scheme

Votes are encrypted using:
- **ECDH** (Elliptic Curve Diffie-Hellman) on Baby Jubjub curve for key exchange
- **AES-256-GCM** for symmetric encryption
- **SHA-256** for key derivation

### Vote Format

Encrypted vote structure:
```
R_x (64 hex) + R_y (64 hex) + IV (24 hex) + Ciphertext + Auth Tag
```

Decrypted plaintext format:
```
optionIndex|nonce
```

### Performance

- Processes votes in batches of 100
- Real-time progress updates
- Optimized for handling thousands of votes

## Project Structure

```
voting-dashboard/
├── index.html           # Main HTML file
├── src/
│   ├── main.js         # Application entry point
│   ├── voteCounter.js  # Vote counting logic
│   └── style.css       # Styling
├── package.json        # Dependencies
└── vite.config.js      # Vite configuration
```

## Dependencies

- **ethers**: Ethereum library for blockchain interaction
- **circomlibjs**: Cryptographic library for Baby Jubjub curve operations
- **vite**: Fast build tool and dev server

## Troubleshooting

### RPC Block Query Limit Errors
If you get errors like "Maximum allowed number of requested blocks is 2000":
- The dashboard automatically queries blocks in chunks of 2000
- For networks with stricter limits, edit `src/voteCounter.js`:
  - Find `const BLOCK_CHUNK_SIZE = 2000;`
  - Reduce to 1000 or 500 as needed

### Connection Issues
- Verify the RPC URL is correct and accessible
- Check if the blockchain node is running
- Ensure firewall allows connections

### Decryption Errors
- Verify the private key matches the public key used for encryption
- Check that the election ID is correct
- Ensure votes were properly encrypted

### No Votes Found
- Verify the contract address and election ID
- Check if any votes have been submitted
- Ensure you're connected to the correct network

## Development

Built with:
- Vite (build tool)
- Vanilla JavaScript (no framework overhead)
- Web Crypto API (for encryption)
- CSS Variables (for theming)

## License

MIT License

## Support

For issues or questions, please check:
1. The troubleshooting section above
2. Browser console for error messages
3. RPC endpoint logs
