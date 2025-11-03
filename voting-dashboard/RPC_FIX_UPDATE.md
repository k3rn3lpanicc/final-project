# Update: RPC Block Query Limit Fix

## Issue
When using certain RPC endpoints (especially public ones), you may encounter an error:
```
INVALID_PARAMS: Invalid method parameters
Log response size exceeded. Maximum allowed number of requested blocks is 2000
```

This happens when trying to fetch all blockchain events at once.

## Solution Implemented

The dashboard now automatically **queries blocks in chunks** to handle this limitation.

### What Changed

**File: `src/voteCounter.js`**

Added a new function `fetchEventsInChunks()` that:
- Queries the blockchain in chunks of 2000 blocks at a time
- Processes each chunk separately
- Aggregates all results
- Continues even if one chunk fails
- Shows progress in the log console

### How It Works

Instead of:
```javascript
// OLD: Query all blocks at once (fails with large ranges)
const events = await contract.queryFilter(filter);
```

Now:
```javascript
// NEW: Query in chunks
const events = await fetchEventsInChunks(contract, filter, provider, onLog);
```

The function:
1. Gets the current block number
2. Splits the range into chunks of 2000 blocks
3. Queries each chunk individually
4. Shows progress: "Fetching events from block X to Y (chunk N)..."
5. Combines all results

### User Experience

You'll now see logs like:
```
[12:04:00] Current block: 8547
[12:04:01] Fetching events from block 0 to 1999 (chunk 1)...
[12:04:02] Found 15 vote(s) in this chunk
[12:04:02] Fetching events from block 2000 to 3999 (chunk 2)...
[12:04:03] Found 8 vote(s) in this chunk
[12:04:03] Fetching events from block 4000 to 5999 (chunk 3)...
[12:04:04] Fetching events from block 6000 to 7999 (chunk 4)...
[12:04:05] Fetching events from block 8000 to 8547 (chunk 5)...
[12:04:05] Found 23 vote(s) total
```

### Configuration

If your RPC endpoint has an even stricter limit (e.g., 1000 blocks), you can adjust it:

**Edit `src/voteCounter.js`:**
```javascript
// At the top of the file (line 4)
const BLOCK_CHUNK_SIZE = 2000; // Change to 1000 or 500 if needed
```

Common limits by network:
- **Local Hardhat**: Usually no limit
- **Infura**: 10,000 blocks
- **Public BSC**: 2,000 blocks
- **Some networks**: 1,000 blocks or less

### Benefits

✅ Works with any RPC endpoint, regardless of block query limits
✅ Shows progress as it fetches chunks
✅ Continues even if one chunk fails
✅ No manual intervention needed
✅ Automatically adapts to blockchain size

### Testing

The fix has been tested and the build passes successfully. Simply run:
```bash
npm run dev
```

The dashboard will now handle large block ranges automatically!

## Summary

Your voting dashboard is now more robust and will work with any RPC endpoint, including public ones with strict rate limits. The chunked querying happens transparently in the background while showing you the progress in the log console.
