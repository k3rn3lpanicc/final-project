# Signing Verification Summary

## Overview
This document confirms that the backend and frontend are signing the exact same message for voter credentials.

## Signing Process

### Backend (NestJS - `crypto.service.ts`)
```typescript
async signCredentials(
  privateKeyHex: string,
  voterId: bigint,
  secretX: bigint,
  secretXp: bigint,
)
```

**Steps:**
1. Compute `hashXp = Poseidon(secretXp)` using `poseidon1([secretXp])`
2. Compute `msgField = Poseidon(voterId, secretX, hashXp)` using `poseidon3([voterId, secretX, hashXp])`
3. Convert `msgField` to 32-byte little-endian representation
4. Sign using EdDSA Pedersen: `signature = eddsa.signPedersen(privKey, msgBytes)`
5. Return `{R8x, R8y, S}` components

### Frontend (TypeScript - `zkUtils.ts`)
```typescript
async function generateVoteInput(
  credentials: VoteCredentials,
  electionId: bigint,
  issuerPrivateKey: Uint8Array
): Promise<CircuitInput>
```

**Steps:**
1. Compute `hashXp = poseidon1([Xp])`
2. Compute `msgField = poseidon3([ID, X, hashXp])`
3. Convert `msgField` to 32-byte little-endian representation using `toBytesLE32()`
4. Sign using EdDSA Pedersen: `signature = eddsa.signPedersen(issuerPrivateKey, msgBytes)`
5. Convert signature components to bit arrays for circuit input

## Variable Mapping
- Backend `voterId` ≡ Frontend `ID`
- Backend `secretX` ≡ Frontend `X`
- Backend `secretXp` ≡ Frontend `Xp`

## Circuit Verification
The circuit (`VoteScheme.circom`) expects:
```circom
// Private inputs
signal input ID;
signal input X;
signal input Xp;

// Signature verification
// 1) Compute msg = Poseidon(ID, X, H(X'))
//    where H(X') = Poseidon(Xp)
// 2) Verify EdDSA signature on msg
```

## Confirmation
✅ **The backend signing logic matches the frontend signing logic exactly.**

Both:
- Use the same hash function (Poseidon)
- Compute the same message: `Poseidon(ID/voterId, X/secretX, Poseidon(Xp/secretXp))`
- Use the same signing algorithm (EdDSA Pedersen)
- Use the same private key (configured in `.env` as `ADMIN_PRIVATE_KEY`)

## Admin Private Key
The admin's private key is stored in `backend/.env`:
```
ADMIN_PRIVATE_KEY=0001020304050607080900010203040506070809000102030405060708090001
```

This key is used by the backend to sign voter registration requests. The corresponding public key is exposed via the `/admin/public-key` endpoint for the frontend to use during proof generation.

## Workflow
1. **User submits registration** → Backend stores credentials (ID, X, Xp)
2. **Admin approves request** → Backend signs: `Poseidon(ID, X, Poseidon(Xp))` → Stores signature (R8x, R8y, S)
3. **User retrieves signature** → Frontend gets signature components
4. **User generates proof** → Frontend creates circuit input with signature
5. **User votes** → Proof is verified on-chain

The signature ensures that only the admin-approved voters can generate valid proofs.
