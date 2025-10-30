// Utility functions for zkSNARK operations
import { poseidon1, poseidon3 } from 'poseidon-lite';
import { buildEddsa, buildBabyjub } from 'circomlibjs';

const BN128_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Generate random BigInt within BN128 field
export function generateRandomField(): bigint {
  let val: bigint;
  do {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    val = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  } while (val >= BN128_FIELD);
  return val;
}

// Convert BigInt to 32-byte little-endian array
export function toBytesLE32(n: bigint): Uint8Array {
  let x = BigInt(n);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number((x >> (8n * BigInt(i))) & 0xffn);
  }
  return out;
}

// Convert bytes to bits (little-endian)
export function bytesToBitsLE(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    for (let k = 0; k < 8; k++) {
      bits.push((b >> k) & 1);
    }
  }
  return bits;
}

export interface VoteCredentials {
  ID: bigint;
  X: bigint;
  Xp: bigint;
}

export interface CircuitInput {
  nh: string;
  electionId: string;
  A: number[];
  ID: string;
  X: string;
  Xp: string;
  R8: number[];
  S: number[];
}

// Generate vote input for the circuit
export async function generateVoteInput(
  credentials: VoteCredentials,
  electionId: bigint,
  issuerPrivateKey: Uint8Array
): Promise<CircuitInput> {
  const eddsa = await buildEddsa();
  const babyjub = await buildBabyjub();

  const { ID, X, Xp } = credentials;

  // Compute Poseidon hashes (matches circomlib v2)
  const hashXp = poseidon1([Xp]);
  const msgField = poseidon3([ID, X, hashXp]);

  // Sign the message
  const msgBytes = toBytesLE32(msgField);
  const signature = eddsa.signPedersen(issuerPrivateKey, msgBytes);

  // Compute nullifier
  const nullifier = poseidon3([X, Xp, electionId]);

  // Get issuer's public key
  const issuerPubKey = eddsa.prv2pub(issuerPrivateKey);

  // Convert to circuit input format (bits)
  const A_bits = bytesToBitsLE(babyjub.packPoint(issuerPubKey));
  const R8_bits = bytesToBitsLE(babyjub.packPoint(signature.R8));
  const S_bits = bytesToBitsLE(toBytesLE32(BigInt(signature.S)));

  return {
    nh: nullifier.toString(),
    electionId: electionId.toString(),
    A: A_bits,
    ID: ID.toString(),
    X: X.toString(),
    Xp: Xp.toString(),
    R8: R8_bits,
    S: S_bits,
  };
}

// Verify signature locally (before generating proof)
export async function verifySignature(
  credentials: VoteCredentials,
  electionId: bigint,
  issuerPrivateKey: Uint8Array
): Promise<boolean> {
  const eddsa = await buildEddsa();
  const babyjub = await buildBabyjub();

  const { ID, X, Xp } = credentials;

  // Compute hashes
  const hashXp = poseidon1([Xp]);
  const msgField = poseidon3([ID, X, hashXp]);

  // Sign
  const msgBytes = toBytesLE32(msgField);
  const signature = eddsa.signPedersen(issuerPrivateKey, msgBytes);

  // Verify
  const issuerPubKey = eddsa.prv2pub(issuerPrivateKey);
  return eddsa.verifyPedersen(msgBytes, signature, issuerPubKey);
}
