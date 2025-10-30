# Solidity Verifier Integration Guide

## Contract Information

**File**: `VoteSchemeVerifier.sol`  
**Size**: ~107 KB  
**Solidity Version**: >=0.7.0 <0.9.0  
**License**: GPL-3.0  
**Generated**: October 31, 2025

## Contract Interface

```solidity
contract Groth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[259] calldata _pubSignals
    ) public view returns (bool);
}
```

### Parameters

- **_pA**: Proof element A (2 uint256 values)
- **_pB**: Proof element B (2x2 uint256 values)
- **_pC**: Proof element C (2 uint256 values)
- **_pubSignals**: Public signals (259 uint256 values)
  - `_pubSignals[0]` = valid (output, always 1)
  - `_pubSignals[1]` = nh (nullifier hash)
  - `_pubSignals[2]` = electionId
  - `_pubSignals[3..258]` = A[256] (issuer public key bits)

### Return Value

- **true**: Proof is valid
- **false**: Proof is invalid

## Deployment

### Using Hardhat

1. Install Hardhat:
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

2. Create deployment script `scripts/deploy.js`:
```javascript
async function main() {
    const Verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.deployed();
    console.log("Verifier deployed to:", verifier.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
```

3. Deploy:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### Using Remix

1. Open [Remix IDE](https://remix.ethereum.org)
2. Create new file `VoteSchemeVerifier.sol`
3. Paste the contract code
4. Compile with Solidity 0.8.x
5. Deploy to your network

### Using Foundry

```bash
forge create --rpc-url $RPC_URL --private-key $PRIVATE_KEY src/VoteSchemeVerifier.sol:Groth16Verifier
```

## Usage Example

### JavaScript (ethers.js)

```javascript
const { ethers } = require("ethers");

// Load contract
const verifierABI = [...]; // Load from compiled artifacts
const verifier = new ethers.Contract(verifierAddress, verifierABI, provider);

// Load proof and public signals
const proof = require('./proof.json');
const publicSignals = require('./public.json');

// Format proof for Solidity
const proofForSolidity = [
    proof.pi_a.slice(0, 2),
    [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    proof.pi_c.slice(0, 2),
    publicSignals
];

// Verify proof
const isValid = await verifier.verifyProof(...proofForSolidity);
console.log("Proof valid:", isValid);
```

### Solidity (Integration)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[259] calldata _pubSignals
    ) external view returns (bool);
}

contract VotingSystem {
    IGroth16Verifier public verifier;
    
    // Track used nullifiers to prevent double voting
    mapping(bytes32 => bool) public usedNullifiers;
    
    // Track elections
    mapping(uint256 => bool) public activeElections;
    
    // Issuer's public key (stored as 256 bits)
    uint256[256] public issuerPublicKey;
    
    constructor(address _verifier, uint256[256] memory _issuerPubKey) {
        verifier = IGroth16Verifier(_verifier);
        issuerPublicKey = _issuerPubKey;
    }
    
    function castVote(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[259] calldata _pubSignals
    ) external {
        // Extract public inputs
        uint256 nullifier = _pubSignals[1];
        uint256 electionId = _pubSignals[2];
        
        // Verify election is active
        require(activeElections[electionId], "Election not active");
        
        // Verify nullifier not used (prevent double voting)
        bytes32 nullifierHash = bytes32(nullifier);
        require(!usedNullifiers[nullifierHash], "Already voted");
        
        // Verify issuer public key matches
        for (uint i = 0; i < 256; i++) {
            require(_pubSignals[3 + i] == issuerPublicKey[i], "Invalid issuer key");
        }
        
        // Verify the zkSNARK proof
        require(
            verifier.verifyProof(_pA, _pB, _pC, _pubSignals),
            "Invalid proof"
        );
        
        // Mark nullifier as used
        usedNullifiers[nullifierHash] = true;
        
        // Record the vote (in this example, just emit an event)
        emit VoteCast(electionId, nullifier);
    }
    
    event VoteCast(uint256 indexed electionId, uint256 nullifier);
}
```

## Gas Costs

Approximate gas costs on Ethereum mainnet:

- **Deployment**: ~3,000,000 gas (~$30-100 depending on gas price)
- **Verification**: ~250,000 gas per proof (~$2-8 per vote verification)

**Note**: These are estimates. Actual costs vary by network and gas prices.

## Optimization Tips

1. **Use Layer 2 solutions** (Arbitrum, Optimism, zkSync) for lower costs
2. **Batch verifications** if your use case allows
3. **Consider Polygon** or other sidechains for testing/production

## Testing

### Unit Test Example (Hardhat)

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VoteScheme Verifier", function () {
    it("Should verify valid proof", async function () {
        const Verifier = await ethers.getContractFactory("Groth16Verifier");
        const verifier = await Verifier.deploy();
        await verifier.deployed();
        
        // Load test proof
        const proof = require("../proof.json");
        const publicSignals = require("../public.json");
        
        // Format for Solidity
        const formattedProof = [
            proof.pi_a.slice(0, 2),
            [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
            proof.pi_c.slice(0, 2),
            publicSignals
        ];
        
        // Verify
        const result = await verifier.verifyProof(...formattedProof);
        expect(result).to.be.true;
    });
});
```

## Security Considerations

1. ✅ **Proof verification is deterministic** - same inputs always give same result
2. ✅ **No reentrancy risks** - view function only reads state
3. ⚠️ **Nullifier tracking** - implement in your voting contract to prevent double-voting
4. ⚠️ **Public key verification** - ensure issuer's public key matches expected value
5. ⚠️ **Election management** - implement proper election lifecycle management

## Network Deployment Addresses

Track your deployments here:

| Network | Address | Block | Date |
|---------|---------|-------|------|
| Sepolia | TBD | - | - |
| Mumbai | TBD | - | - |
| Mainnet | TBD | - | - |

## Support

For issues or questions:
- Check `progress.md` for detailed documentation
- Review `COMMANDS.md` for proof generation workflow
- See `README.md` for frontend integration

## License

GPL-3.0 (as per snarkJS generated code)
