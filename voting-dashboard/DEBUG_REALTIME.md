# Debug: Real-Time Updates Not Working

## Please Check These Things

### 1. Open Browser Console (F12)

After clicking "Start Counting", look for these console messages:

#### A. Batch Updates Being Sent?
```
Sending batch update: { batch: 1, processed: 100, validVotes: 98, voteCounts: {...} }
Sending batch update: { batch: 2, processed: 200, validVotes: 196, voteCounts: {...} }
...
```

**If you DON'T see this:**
- The onUpdate callback is not being called
- Problem is in voteCounter.js

**If you DO see this, continue to B:**

#### B. UI Update Function Being Called?
```
UI update called with: { voteCounts: {...}, validVotes: 98, ... }
Updating UI elements
Results section shown
```

**If you DON'T see this:**
- The callback is being sent but not received
- Problem is in how callback is passed

**If you DO see this:**
- The updates are working but maybe too fast to see
- Try increasing batch size delay

### 2. Check Vote Count

How many votes are you testing with?
- **< 100 votes**: Only 1 batch, you won't see incremental updates
- **100-200 votes**: 2 batches, should see 1 update mid-way
- **> 1000 votes**: 10+ batches, should see many updates

### 3. Check Processing Speed

If votes are processing too fast (< 1 second total):
- You might not notice the incremental updates
- Results appear to show up "instantly"
- This is normal for small numbers of votes

### 4. Visual Test

Try this:
1. Start counting votes
2. **Watch the Results section** below the progress bar
3. Does it appear BEFORE "Processing complete" message?
4. Do the vote numbers grow gradually or appear all at once?

## What Should Happen

### Correct Behavior:
```
1. Click "Start Counting"
2. Progress bar starts: 0% → 10% → 20%...
3. Results section APPEARS when progress is around 20%
4. Vote counts show: "Valid: 18" → "Valid: 38" → "Valid: 57"...
5. Bars grow gradually
6. Progress reaches 100%
7. "Processing complete!" message
8. Final results shown
```

### Incorrect Behavior (Current?):
```
1. Click "Start Counting"
2. Progress bar starts: 0% → ... → 100%
3. "Processing complete!" message
4. Results section appears with FINAL numbers
5. Everything shows up at once
```

## Testing With Console

Run this in browser console while counting:
```javascript
// Check if results section is visible
document.getElementById('results-section').style.display

// Should show 'block' BEFORE processing completes
```

## Quick Fix to Test

If you want to see updates more clearly, edit `src/voteCounter.js`:

Change line 4:
```javascript
const BATCH_SIZE = 10; // Was 100, now smaller batches = more updates
```

Then rebuild:
```bash
npm run build
```

This will create 10x more update events, making them more visible.

## Share Results

Please share:
1. **Console output** - All messages that appear
2. **Vote count** - How many votes are you testing with?
3. **Timing** - How long does counting take?
4. **Behavior** - Does Results section appear before or after "Processing complete"?

This will help me identify the exact issue!

## Most Likely Issues

Based on symptoms:

### Issue 1: Too Few Votes
If < 100 votes, you'll only have 1 batch = no incremental updates

**Solution**: Test with more votes or reduce BATCH_SIZE

### Issue 2: Too Fast
If processing takes < 1 second, updates happen too fast to notice

**Solution**: Normal behavior, updates are working but imperceptible

### Issue 3: Callback Not Connected
If console shows NO "Sending batch update" messages

**Solution**: Check that onUpdate callback is properly passed

### Issue 4: UI Not Updating
If console shows updates being sent but UI doesn't change

**Solution**: Check requestAnimationFrame is working

## Test Command

To verify callbacks are working, add this temporarily to main.js:

```javascript
onUpdate: (data) => {
  console.log('🔥 BATCH COMPLETE:', data.processed, 'votes');
  updateResultsIncremental(data);
},
```

You should see "🔥 BATCH COMPLETE" in console for each batch.
