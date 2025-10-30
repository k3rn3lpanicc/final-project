# Quick Command Reference

## Setup (First Time Only)

### Install Dependencies
```bash
npm install
```

### Generate Powers of Tau Files
```bash
snarkjs powersoftau new bn128 17 pot17_0000.ptau -v
snarkjs powersoftau contribute pot17_0000.ptau pot17_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 pot17_0001.ptau pot17_final.ptau -v
snarkjs powersoftau verify pot17_final.ptau
```

## Build Workflow

### 1. Compile Circuit
```bash
.\circom.exe VoteScheme.circom --r1cs --wasm --sym -o build -l node_modules
```

### 2. Generate Circuit Keys
```bash
snarkjs groth16 setup build/VoteScheme.r1cs pot17_final.ptau VoteScheme_0000.zkey
snarkjs zkey contribute VoteScheme_0000.zkey VoteScheme_final.zkey --name="Contribution" -v
snarkjs zkey verify build/VoteScheme.r1cs pot17_final.ptau VoteScheme_final.zkey
snarkjs zkey export verificationkey VoteScheme_final.zkey verification_key.json
```

## Testing Workflow

### 3. Generate Test Inputs
```bash
node get_input.js
```

### 4. Create Witness
```bash
cd build\VoteScheme_js
node generate_witness.js VoteScheme.wasm ..\..\input.json witness.wtns
cd ..\..
```

### 5. Generate Proof
```bash
snarkjs groth16 prove VoteScheme_final.zkey build/VoteScheme_js/witness.wtns proof.json public.json
```

### 6. Verify Proof
```bash
snarkjs groth16 verify verification_key.json public.json proof.json
```

## Deployment

### 7. Export Solidity Verifier
```bash
snarkjs zkey export solidityverifier VoteScheme_final.zkey VoteSchemeVerifier.sol
```

## One-Liner Commands

### Full Build from Scratch
```bash
npm install && .\circom.exe VoteScheme.circom --r1cs --wasm --sym -o build -l node_modules && snarkjs groth16 setup build/VoteScheme.r1cs pot17_final.ptau VoteScheme_0000.zkey && snarkjs zkey contribute VoteScheme_0000.zkey VoteScheme_final.zkey --name="Contribution" -v && snarkjs zkey export verificationkey VoteScheme_final.zkey verification_key.json
```

### Generate and Verify Proof
```bash
node get_input.js && cd build\VoteScheme_js && node generate_witness.js VoteScheme.wasm ..\..\input.json witness.wtns && cd ..\.. && snarkjs groth16 prove VoteScheme_final.zkey build/VoteScheme_js/witness.wtns proof.json public.json && snarkjs groth16 verify verification_key.json public.json proof.json
```

## File Outputs

| Command | Output File(s) |
|---------|---------------|
| Compile | `build/VoteScheme.r1cs`, `build/VoteScheme_js/VoteScheme.wasm` |
| Setup | `VoteScheme_0000.zkey` |
| Contribute | `VoteScheme_final.zkey` |
| Export VK | `verification_key.json` |
| Generate inputs | `input.json` |
| Generate witness | `build/VoteScheme_js/witness.wtns` |
| Generate proof | `proof.json`, `public.json` |
| Export verifier | `VoteSchemeVerifier.sol` |

## Troubleshooting

### Circuit fails to compile
```bash
# Check circomlib path
.\circom.exe VoteScheme.circom --r1cs --wasm --sym -o build -l node_modules
```

### Witness generation fails
```bash
# Regenerate inputs
node get_input.js

# Try again
cd build\VoteScheme_js
node generate_witness.js VoteScheme.wasm ..\..\input.json witness.wtns
```

### Proof verification fails
```bash
# Verify the keys first
snarkjs zkey verify build/VoteScheme.r1cs pot17_final.ptau VoteScheme_final.zkey

# Check public inputs match
cat public.json
```

## Clean Build

To start fresh:
```bash
# Remove generated files
Remove-Item -Recurse -Force build, VoteScheme_*.zkey, verification_key.json, proof.json, public.json, VoteSchemeVerifier.sol, input.json

# Rebuild everything
.\circom.exe VoteScheme.circom --r1cs --wasm --sym -o build -l node_modules
```
