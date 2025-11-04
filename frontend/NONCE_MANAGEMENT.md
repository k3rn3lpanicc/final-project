# Nonce Management for Concurrent Transactions

## Problem
When using a fixed private key for all vote submissions, concurrent users submitting votes simultaneously would encounter nonce conflicts. Multiple transactions would attempt to use the same nonce, causing most transactions to fail.

## Solution
Implemented a transaction queue system with intelligent nonce management to handle concurrent vote submissions from multiple users.

## Implementation Details

### Transaction Queue Class
- **Purpose**: Serializes all transactions from the same wallet to prevent nonce conflicts
- **Features**:
  - Queues incoming transactions
  - Processes transactions sequentially with small delays
  - Manages nonce increment automatically
  - Handles edge cases where network nonce might be higher

### How It Works

1. **Transaction Queuing**
   - All vote submissions are added to a queue
   - Transactions are processed one at a time in FIFO order
   - A 100ms delay between transactions ensures proper propagation

2. **Nonce Management**
   - Fetches the current nonce from the network for each transaction
   - Maintains a local nonce counter that increments with each queued transaction
   - Uses the higher of: network nonce or local tracked nonce
   - Automatically resets if network nonce is higher (handles external transactions)

3. **Error Handling**
   - Transactions wrapped in try-catch to prevent one failure from blocking the queue
   - Detailed error messages for common blockchain errors
   - Progress callbacks inform users of transaction status

### Benefits

✅ **Concurrent User Support**: Multiple users can submit votes simultaneously without conflicts

✅ **Automatic Sequencing**: No manual coordination needed between users

✅ **Resilient**: Handles network delays and recovers from transient errors

✅ **User-Friendly**: Progress updates keep users informed during queuing and submission

## Code Structure

```typescript
class TransactionQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private currentNonce: number | null = null;

  async add<T>(transaction: () => Promise<T>): Promise<T>
  private async process(): Promise<void>
  getNextNonce(baseNonce: number): number
}
```

## Usage

The queue is transparent to the calling code:

```typescript
// Automatically queued and executed with proper nonce
const result = await submitVote(proof, publicSignals, encryptedVote);
```

## Performance Considerations

- **Sequential Processing**: Transactions are processed one at a time
- **Delay**: 100ms between transactions (adjustable)
- **Throughput**: ~10 transactions per second (limited by network confirmation time)
- **Scalability**: Suitable for elections with hundreds of voters

## Future Improvements

1. **Multiple Wallets**: Distribute load across multiple private keys
2. **Dynamic Delays**: Adjust delays based on network conditions
3. **Priority Queue**: Allow urgent transactions to skip ahead
4. **Nonce Gap Detection**: Automatically detect and fill nonce gaps

## Security Notes

⚠️ **Private Key Exposure**: The private key is hardcoded in the client code. For production:
- Move to environment variables
- Use backend service to sign transactions
- Implement key rotation
- Monitor wallet balance and activity

## Testing

To test concurrent voting:
1. Open multiple browser tabs
2. Have different users submit votes simultaneously
3. Observe sequential processing in console logs
4. Verify all transactions succeed with unique nonces

## Monitoring

Transaction status can be monitored via:
- Browser console logs showing nonce assignments
- Progress callbacks displaying queue position
- Blockchain explorer for transaction confirmation
