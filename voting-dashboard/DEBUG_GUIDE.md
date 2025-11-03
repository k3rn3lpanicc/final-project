# Debug Guide: Vote Counting Issues

I've added extensive debug logging to help identify the issue. Please follow these steps:

## Step 1: Open Browser Developer Console

1. Open the voting dashboard in your browser
2. Press **F12** (or Right-click → Inspect)
3. Go to the **Console** tab
4. Keep it open while testing

## Step 2: Clear Console and Start Counting

1. Click "Clear console" button in developer tools
2. Fill in your election details:
   - Contract Address
   - Election ID
   - Private Key
   - RPC URL
3. Click "Start Counting"

## Step 3: Check Console Output

Look for these messages in the console:

### A. Vote Fetching
```
First vote data length: XXX chars
First event details: { voter: "0x...", encryptedVoteLength: XXX, ... }
```

**If you DON'T see this:**
- Problem: No votes are being fetched from the blockchain
- Possible causes:
  - Wrong election ID
  - Wrong contract address
  - Votes don't exist for this election
  - Start block is after the votes were cast

### B. Decryption Attempt
For each vote, you should see:
```
Decryption attempt: {
  dataLength: XXX,
  ivLength: 24,
  ciphertextLength: XXX,
  rx: "...",
  ry: "..."
}
Shared secret computed: ...
AES key derived, length: 32
IV length: 12, Ciphertext+Tag length: XXX
Crypto key imported
Decryption successful
Plaintext: "0|some-nonce"
```

**If you see "Decryption error":**
- Problem: Decryption is failing
- Check the error message for details

## Step 4: Share Console Output

Please copy and paste:

1. **Any error messages** (in red)
2. **The first few "Decryption attempt" logs**
3. **Any "Decryption error" messages**
4. **The vote count summary** at the end

## Common Issues to Check

### Issue 1: No Votes Found
**Console shows:** "Found 0 vote(s) total"

**Check:**
- Is the election ID correct?
- Are votes submitted to this contract?
- Try manual start block in Advanced Options

### Issue 2: All Votes Invalid
**Console shows:** "Invalid votes: X" (all votes invalid)

**Check:**
- Is the private key correct?
- Does it match the public key used to encrypt votes?
- Check console for "Decryption error" messages

### Issue 3: Wrong Election ID Filter
**Console shows:** Votes found but all have wrong electionId

**Check:**
- The VoteSubmitted event filter uses the electionId parameter
- Make sure you're entering the right election ID

### Issue 4: Data Format Issues
**Console shows:** "Encrypted data too short" or similar

**Check:**
- Encrypted vote data format
- Make sure votes were encrypted correctly

## Example of SUCCESSFUL Decryption

You should see something like this in console:

```
Found 3 vote(s) total
First vote data length: 220 chars

Decryption attempt: { dataLength: 218, ivLength: 24, ciphertextLength: 66, ... }
Shared secret computed: 1a2b3c4d5e...
AES key derived, length: 32
IV length: 12, Ciphertext+Tag length: 33
Crypto key imported
Decryption successful
Plaintext: "1|abc123def456"

Decryption attempt: { dataLength: 218, ... }
...
Decryption successful
Plaintext: "0|xyz789ghi012"

Processing complete! Total time: 1.23s
Valid votes: 3
Invalid votes: 0
```

## After Testing

Please share:
1. Screenshot of the browser console
2. Any error messages
3. The exact inputs you're using (contract, election ID, RPC - private key can be masked)

This will help me identify exactly where the problem is occurring.

## Quick Test

Try this simple test:
1. Open console (F12)
2. Type: `console.log("Test:", BigInt("250082668618633646334213584719494925374420844776732603861415520274085646643"))`
3. Press Enter

If this works, the browser supports BigInt (required for decryption).
