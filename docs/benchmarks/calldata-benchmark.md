# Benchmark: Transaction Calldata Size

## Objective

Measure the size of data sent to the smart contract during vote
submission.

## Command

node ./benchmark_calldata.js

## Result Summary

### Submit Vote

- Calldata Size: \~8.7 KB
- Gas Used: \~2,000,000

## Conclusion

Most calldata size is due to proof data. No identity information is
transmitted.
