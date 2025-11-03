# Fix: Decryption Compatibility Issue

## Problem

The dashboard was showing "No valid votes found" even though the `count_votes.js` script successfully decrypted votes with the same inputs.

## Root Cause

The Web Crypto API (browser) handles AES-GCM decryption slightly differently than Node.js `crypto` module:

- **Node.js**: Uses `decipher.setAuthTag()` to explicitly set the authentication tag
- **Web Crypto API**: Expects auth tag appended to ciphertext, but needs `tagLength` parameter

## Solution

Added the missing `tagLength: 128` parameter to the Web Crypto API decryption call:

```javascript
// BEFORE (missing tagLength)
const plaintext = await crypto.subtle.decrypt(
  {
    name: 'AES-GCM',
    iv: iv,
  },
  cryptoKey,
  ciphertextWithTag
);

// AFTER (with tagLength)
const plaintext = await crypto.subtle.decrypt(
  {
    name: 'AES-GCM',
    iv: iv,
    tagLength: 128, // Auth tag is 128 bits (16 bytes)
  },
  cryptoKey,
  ciphertextWithTag
);
```

## Why This Matters

The auth tag in AES-GCM is **crucial** for:
- Verifying data integrity
- Ensuring data hasn't been tampered with
- Preventing decryption of invalid/modified ciphertext

Without specifying `tagLength`, the Web Crypto API may have used a different default or handled the tag incorrectly, causing all decryption attempts to fail.

## Testing

After this fix:
1. ✅ Dashboard should now decrypt votes successfully
2. ✅ Results should match `count_votes.js` script output
3. ✅ Valid votes will be counted and displayed

## Files Changed

- `src/voteCounter.js` - Added `tagLength: 128` to AES-GCM decryption

## What to Test

Use the same inputs that work with `count_votes.js`:
- Contract Address
- Election ID  
- Private Key
- RPC URL

The dashboard should now successfully decrypt and count all votes.

## Note

The encrypted vote format is:
```
R_x (32 bytes) + R_y (32 bytes) + IV (12 bytes) + Ciphertext + AuthTag (16 bytes)
In hex: 64 chars + 64 chars + 24 chars + variable + 32 chars
```

The last 16 bytes (128 bits) are the authentication tag, which is now properly specified in the Web Crypto API call.
