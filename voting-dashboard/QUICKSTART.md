# Voting Dashboard - Quick Start Guide

## Installation & Running

```bash
# Navigate to the project
cd voting-dashboard

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

The dashboard will be available at `http://localhost:5173`

## Example Usage

### Scenario 1: Local Hardhat Network

```
Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Election ID: 1
Private Key: 250082668618633646334213584719494925374420844776732603861415520274085646643
RPC URL: http://127.0.0.1:8545/
```

### Scenario 2: BSC Testnet

```
Contract Address: 0xYourContractAddress...
Election ID: 1
Private Key: YourElectionPrivateKey...
RPC URL: https://data-seed-prebsc-1-s1.binance.org:8545/
```

## What to Expect

1. **Form Input**: Fill in the election details
2. **Start Processing**: Click "Start Counting"
3. **Progress Updates**: Watch real-time progress with:
   - Percentage complete
   - Votes processed count
   - Processing rate (votes/sec)
   - Elapsed time
   - Estimated time remaining
4. **Results Display**:
   - Total votes received
   - Valid votes count
   - Invalid votes count
   - Processing time
   - Vote distribution with visual bars
   - Percentage for each option
5. **Export**: Download complete results as JSON

## Sample Output

The dashboard will show something like:

```
Progress: 1000/1000 (100.0%) | 125.5 votes/sec | Elapsed: 7.9s | ETA: 0s

Total Votes: 1000
Valid Votes: 998
Invalid Votes: 2
Processing Time: 7.96s

Vote Distribution:
Option 0: 450 votes (45.09%)
[████████████████████████████████████████]

Option 1: 350 votes (35.07%)
[████████████████████████████████]

Option 2: 198 votes (19.84%)
[████████████████]
```

## Troubleshooting

**Dashboard won't start?**
- Make sure you're in the `voting-dashboard` directory
- Run `npm install` first
- Check that Node.js is installed: `node --version`

**"Cannot connect to RPC"?**
- Verify the RPC URL is correct
- For local network, make sure Hardhat node is running: `npx hardhat node`
- Check firewall settings

**"No votes found"?**
- Double-check the contract address
- Verify the election ID is correct
- Make sure votes have been submitted for this election

**All votes show as "Invalid"?**
- Verify the private key matches the public key used for encryption
- Ensure the private key is entered correctly (no spaces)

## Features at a Glance

✅ Real-time progress tracking
✅ Batch processing for speed
✅ Visual vote distribution
✅ Invalid vote reporting
✅ JSON export for analysis
✅ Responsive design
✅ Secure (private key stays in browser)

## Next Steps

After viewing results:
1. Download the JSON file for records
2. Share visualized results with stakeholders
3. Verify invalid votes if any exist
4. Archive results for transparency

## Production Deployment

To deploy to production:

```bash
# Build the project
npm run build

# The 'dist' folder contains your production files
# Deploy the contents to your web server
```

For hosting options:
- Vercel
- Netlify
- GitHub Pages
- Your own web server

---

**Need Help?** Check the main README.md for detailed documentation.
