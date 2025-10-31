# Debugging On-Chain Verification Issues

## Error: "could not decode result data (value="0x")"

This error means the contract call is returning empty data, which typically happens when the contract function reverts.

## Verified Working

✅ Contract is deployed at: `0x04172AC48eB0e8B6d634ABcB78129b43469F6Ab8`  
✅ Contract has the `verifyProof` function  
✅ Function can be called successfully with dummy data  
✅ Network: Hardhat local (Chain ID: 121212)

## Common Causes

### 1. **Invalid Field Elements**

The most likely cause is that one or more proof elements are:
- Greater than or equal to the BN128 field modulus
- Negative numbers
- Not proper BigNumber format

**Solution**: Check browser console for the formatted proof output

### 2. **Public Signals Count Mismatch**

Contract expects exactly **259** public signals:
- 1 for `valid`
- 1 for `nh` (nullifier)
- 1 for `electionId`
- 256 for issuer public key `A`

**Check**: Ensure `publicSignals.length === 259`

### 3. **Proof Format Issues**

The proof from snarkjs needs specific formatting for Solidity:
- `pi_a`: Remove the 3rd coordinate (implicit 1)
- `pi_b`: Swap coordinates within each pair
- `pi_c`: Remove the 3rd coordinate (implicit 1)

## Debugging Steps

### Step 1: Check Browser Console

After clicking "Verify On-Chain", check the browser console for:

```javascript
{
  formatted: {
    pA: [...],
    pB: [...],
    pC: [...],
    pubSignalsCount: 259,  // Should be exactly 259
    firstSignal: "...",
    lastSignal: "..."
  }
}
```

### Step 2: Verify Public Signals Count

In console, check:
```javascript
// Should output 259
console.log(publicSignals.length);
```

### Step 3: Check for Field Overflow

All values must be < BN128 field:
```
21888242871839275222246405745257275088548364400416034343698204186575808495617
```

### Step 4: Test with Known Good Proof

Generate a proof that you've verified locally first:
1. Generate credentials
2. Generate proof
3. **Verify locally first** (this MUST pass)
4. Only then try on-chain verification

## Frontend Debugging Enabled

The updated frontend now:
- ✅ Checks if contract exists at address
- ✅ Estimates gas before calling (detects reverts early)
- ✅ Logs formatted proof to console
- ✅ Provides detailed error messages

## Testing the Contract Directly

Use the test script:

```bash
node test-contract.js
```

This verifies:
- Contract is deployed
- Function signature is correct
- Basic calls work

## Most Likely Issue

**The proof data contains invalid field elements that cause the contract to revert.**

### How to Fix:

1. Open browser DevTools (F12)
2. Click "Verify On-Chain"
3. Look at the console output for "Formatted proof"
4. Check if any values look suspicious (very large, negative, etc.)
5. Verify the local verification passed first

## Contract Revert Reasons

The Groth16Verifier contract will revert if:
1. Any input value >= field modulus `r`
2. Pairing check fails (invalid proof)
3. Out of gas (unlikely for view function)

## Quick Fix

If the error persists:

1. **Generate a fresh proof**:
   - Click "Generate Credentials"
   - Click "Generate zkSNARK Proof"
   - **Verify Locally** - this MUST show success
   - Then try "Verify On-Chain"

2. **Check MetaMask network**:
   - Should be connected to "Hardhat" (Chain ID: 121212)
   - RPC: http://127.0.0.1:8545/

3. **Restart Hardhat node**:
   ```bash
   npx hardhat node
   ```
   Then redeploy the contract

## Still Having Issues?

Check the browser console for:
- "Gas estimation failed" - means contract will revert
- "Contract will revert: ..." - shows the revert reason
- Any red error messages

The gas estimation will catch reverts before the actual call, giving better error messages.
