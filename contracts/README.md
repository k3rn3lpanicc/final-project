# Smart Contracts

Solidity smart contracts for the VoteScheme zkSNARK voting system.

## 📋 Overview

This directory contains the smart contracts that handle on-chain vote verification and storage. The contracts verify zkSNARK proofs and manage elections on the blockchain.

## 📦 Contracts

### 1. `VoteSchemeVerifier.sol`

Auto-generated Groth16 verifier contract from snarkjs.

**Purpose**: Verifies zkSNARK proofs on-chain

**Key Functions**:
- `verifyProof(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[3] memory input)` - Verifies a Groth16 proof

**Gas Cost**: ~250,000 gas per verification

**Generated From**: 
```bash
snarkjs zkey export solidityverifier VoteScheme_final.zkey VoteSchemeVerifier.sol
```

### 2. `Election.sol`

Main election management contract.

**Purpose**: Manages elections, stores encrypted votes, and tracks nullifiers

**Key Features**:
- Create elections with multiple options
- Submit votes with zkSNARK proofs
- Nullifier tracking (prevents double voting)
- Encrypted vote storage (ECDH + AES-256-GCM)
- Election lifecycle management

**Key Functions**:

#### Admin Functions
- `constructor(address _verifier)` - Deploy with verifier contract address
- `createElection(uint256 _electionId, string memory _name, string[] memory _options, uint256 _publicKeyX, uint256 _publicKeyY)` - Create new election
- `activateElection(uint256 _electionId)` - Start an election
- `closeElection(uint256 _electionId)` - End an election

#### Voter Functions
- `submitVote(uint256 electionId, uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint256 nullifierHash, bytes memory encryptedVote)` - Submit encrypted vote with zkSNARK proof

#### View Functions
- `getElection(uint256 _electionId)` - Get election details
- `getVoteCount(uint256 _electionId)` - Get total votes for an election
- `hasVoted(uint256 _electionId, uint256 _nullifierHash)` - Check if nullifier was used

**Events**:
- `ElectionCreated(uint256 indexed electionId, string name)`
- `VoteSubmitted(uint256 indexed electionId, address indexed sender, uint256 nullifierHash, bytes encryptedVote)`
- `ElectionActivated(uint256 indexed electionId)`
- `ElectionClosed(uint256 indexed electionId)`

### 3. `VoteSchemeHelper.sol`

Utility library for common operations.

**Purpose**: Shared utility functions

**Functions**:
- Helper functions for encoding/decoding
- Input validation
- Common calculations

## 🚀 Deployment

### Prerequisites

- Hardhat or Truffle
- Node.js with ethers.js
- Web3 wallet with testnet funds
- Compiled verifier contract

### Deploy Script Example

```javascript
const { ethers } = require("hardhat");

async function main() {
  // 1. Deploy Verifier
  const Verifier = await ethers.getContractFactory("VoteSchemeVerifier");
  const verifier = await Verifier.deploy();
  await verifier.deployed();
  console.log("Verifier deployed to:", verifier.address);

  // 2. Deploy Election Contract
  const Election = await ethers.getContractFactory("Election");
  const election = await Election.deploy(verifier.address);
  await election.deployed();
  console.log("Election deployed to:", election.address);

  // 3. Create an election
  const electionId = 1;
  const publicKeyX = "123456..."; // Election public key X coordinate
  const publicKeyY = "789012..."; // Election public key Y coordinate
  
  const tx = await election.createElection(
    electionId,
    "Board Election 2025",
    ["Alice", "Bob", "Charlie"],
    publicKeyX,
    publicKeyY
  );
  await tx.wait();
  console.log("Election created!");

  // 4. Activate election
  const activateTx = await election.activateElection(electionId);
  await activateTx.wait();
  console.log("Election activated!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Deployment Commands

```bash
# Using Hardhat
npx hardhat run scripts/deploy.js --network bsc_testnet

# Using Truffle
truffle migrate --network bsc_testnet

# Verify on BSCScan
npx hardhat verify --network bsc_testnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## 📝 Contract Interaction

### Create Election

```javascript
const tx = await electionContract.createElection(
  1, // electionId
  "Presidential Election", // name
  ["Candidate A", "Candidate B", "Candidate C"], // options
  "12345678901234567890...", // publicKeyX
  "98765432109876543210..." // publicKeyY
);
await tx.wait();
```

### Submit Vote

```javascript
// Proof components from snarkjs
const proof = {
  a: [a1, a2],
  b: [[b1, b2], [b3, b4]],
  c: [c1, c2]
};

const nullifierHash = "123456...";
const encryptedVote = "0xabcdef..."; // ECDH + AES encrypted

const tx = await electionContract.submitVote(
  1, // electionId
  proof.a,
  proof.b,
  proof.c,
  nullifierHash,
  encryptedVote
);
await tx.wait();
```

### Query Election

```javascript
const election = await electionContract.getElection(1);
console.log("Name:", election.name);
console.log("Options:", election.options);
console.log("Active:", election.isActive);
console.log("Votes:", await electionContract.getVoteCount(1));
```

## 🔒 Security Features

### Proof Verification
- ✅ Groth16 zkSNARK verification on-chain
- ✅ Ensures voter has valid credentials without revealing identity
- ✅ ~250K gas per proof verification

### Double-Vote Prevention
- ✅ Nullifier hash tracking
- ✅ Each voter can only vote once per election
- ✅ Nullifier = Poseidon(secretX, secretXp, electionId)

### Vote Privacy
- ✅ Votes stored encrypted on-chain
- ✅ Only election admin with private key can decrypt
- ✅ ECDH + AES-256-GCM encryption

### Access Control
- ✅ Only contract owner can create elections
- ✅ Only active elections accept votes
- ✅ Closed elections cannot receive votes

## ⛽ Gas Costs

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| Deploy Verifier | ~4,000,000 | One-time deployment |
| Deploy Election | ~2,500,000 | One-time deployment |
| Create Election | ~200,000 | Per election |
| Submit Vote | ~300,000 | Per vote (includes proof verification) |
| Query Election | <50,000 | Read-only operation |

## 🧪 Testing

```bash
# Run tests
npx hardhat test

# Test coverage
npx hardhat coverage

# Gas reporter
REPORT_GAS=true npx hardhat test
```

### Test Cases

- ✅ Deploy contracts successfully
- ✅ Create election with valid parameters
- ✅ Reject invalid election creation
- ✅ Submit vote with valid proof
- ✅ Reject vote with invalid proof
- ✅ Prevent double voting (nullifier check)
- ✅ Query election details
- ✅ Activate/close elections
- ✅ Event emission verification

## 📊 Contract ABIs

The `ElectionABI.json` file contains the ABI for the Election contract. Use this in your frontend to interact with the contract:

```javascript
import ElectionABI from './contracts/ElectionABI.json';
import { ethers } from 'ethers';

const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const election = new ethers.Contract(
  "0x123...", // Contract address
  ElectionABI,
  signer
);
```

## 🌐 Deployed Contracts

### BSC Testnet
- **Verifier**: `0x...` (Update after deployment)
- **Election**: `0x...` (Update after deployment)
- **Network**: BSC Testnet (Chain ID: 97)
- **RPC**: https://data-seed-prebsc-1-s1.binance.org:8545/

### Mainnet
- **Verifier**: `0x...` (Update after deployment)
- **Election**: `0x...` (Update after deployment)
- **Network**: BSC Mainnet (Chain ID: 56)
- **RPC**: https://bsc-dataseed.binance.org/

## 🔧 Development

### Compile Contracts

```bash
npx hardhat compile
```

### Update Verifier

```bash
# Re-export from zkey if circuit changes
snarkjs zkey export solidityverifier ../VoteScheme_final.zkey VoteSchemeVerifier.sol
```

### Local Testing

```bash
# Start local node
npx hardhat node

# Deploy to local node
npx hardhat run scripts/deploy.js --network localhost
```

## 📄 License

ISC License

## 🆘 Support

For contract-related issues:
- Check transaction on block explorer
- Review contract events
- Verify input parameters match circuit public signals
- Ensure proof is valid before submission
