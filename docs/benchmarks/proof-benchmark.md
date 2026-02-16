# Benchmark: Average zkSNARK Proof Generation Time

## Objective

Measure the average time required to generate a zkSNARK proof on the
client side.

## Command

node ./benchmark_proof.js

## Environment

- CPU: Intel Core i7-10750H
- RAM: 16 GB
- snarkjs \^0.7.5

## Result Summary

- Average time per proof: \~1.45 seconds
- Throughput: \~0.69 proofs/second

## Conclusion

The average proof generation time is below 5 seconds, satisfying the
requirement.
