# Benchmark: Vote Counting Throughput

## Objective

Measure vote decryption and counting rate on a single client machine.

## Command

node ./benchmark_encryption.js

## Environment

- CPU: Intel Core i7-10750H
- RAM: 16 GB

## Result Summary

- Total votes tested: 2000
- Counting time: \~38 seconds
- Counting rate: \~51 votes/second

## Conclusion

The system processes approximately 50 votes per second on a single
machine, satisfying the updated requirement (\>= 50 votes/second).
Counting can be parallelized across multiple machines.
