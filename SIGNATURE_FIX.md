# Signature Verification Fix & HashXp Implementation

## Summary

Fixed signature verification issues in the backend and implemented the requirement that frontend sends only the hash of `secretXp` instead of the plain value, improving privacy and security.

## Changes Made

### 1. Backend Changes

#### `backend/src/common/crypto.service.ts`
- **Modified `signCredentials()` method**: Now accepts `hashXp` directly instead of `secretXp`
  - Removed `const hashXp = poseidon1([secretXp])`
  - Now uses `hashXp` parameter directly in `poseidon3([voterId, secretX, hashXp])`
  
- **Fixed `verifySignature()` method**: 
  - Changed parameter from `secretXp` to `hashXp`
  - Removed internal hash computation
  - **Critical fix**: Properly convert BigInt strings to field elements using `F.e(BigInt(value))`
  - Fixed signature.S to use field element: `S: F.e(BigInt(S))` instead of `BigInt(S)`

#### `backend/src/database/voter-request.entity.ts`
- Renamed field from `secretXp` to `hashXp`
- Updated comment: `// Hash of secretXp (poseidon1([secretXp]))`

#### `backend/src/common/dto.ts`
- Updated `CreateVoterRequestDto`:
  - Renamed `secretXp` to `hashXp`
  - Updated description: "Hash of Secret Xp (poseidon1([secretXp])) - frontend sends only the hash"
- Updated `VoterRequestResponseDto`:
  - Renamed `secretXp` to `hashXp`

#### `backend/src/admin/admin.service.ts`
- Updated all references from `secretXp` to `hashXp` in:
  - `listAllRequests()` method
  - `listPendingRequests()` method
  - `getRequestDetails()` method
  - `approveRequest()` method - now passes `request.hashXp` to crypto service

#### `backend/src/voters/voters.service.ts`
- Updated all references from `secretXp` to `hashXp` in:
  - `createRequest()` method
  - `getRequest()` method

#### `backend/src/voters/voters.controller.ts`
- Updated Swagger documentation to use `hashXp` instead of `secretXp`

### 2. Frontend Changes (Voter Dashboard)

#### `frontend/src/api.ts`
- Updated `VoterRequest` interface:
  - Changed `secretXp: string` to `hashXp: string`
  - Added comment: `// Hash of secretXp`
  - Added `'auto_rejected'` status type

#### `frontend/src/main.ts`
- **Added import**: `import { poseidon1 } from 'poseidon-lite'`
- **Modified `handleRegistrationSubmit()`**:
  - Compute hash of Xp before sending: `const hashXp = poseidon1([currentCredentials.Xp])`
  - Send `hashXp` to backend instead of plain `secretXp`
  - Backend now receives hashed value, frontend keeps plain `Xp` in localStorage for proof generation

### 3. Admin Dashboard Changes

#### `admin-dashboard/src/api.ts`
- Updated `Request` interface:
  - Changed `secretXp: string` to `hashXp: string`
  - Added comment: `// Hash of secretXp`

## Why These Changes Matter

### Security & Privacy
- **Frontend never sends plain `secretXp` to backend**: Only the hash is transmitted
- **Backend stores only the hash**: No plain secret values in database
- **Proof generation still works**: Frontend keeps plain `Xp` locally for generating proofs

### Bug Fixes
- **Fixed BigInt conversion error**: The signature verification was failing because `F.e()` wasn't being used to convert BigInt strings to field elements
- **Fixed S parameter type**: Changed from `BigInt(S)` to `F.e(BigInt(S))` for proper field element conversion

## How It Works

### Registration Flow
1. **Frontend**: User generates credentials (`ID`, `X`, `Xp`)
2. **Frontend**: Computes `hashXp = poseidon1([Xp])`
3. **Frontend**: Sends to backend: `voterId=ID`, `secretX=X`, `hashXp=hashXp`
4. **Backend**: Stores `voterId`, `secretX`, and `hashXp` (not plain `Xp`)

### Signing Flow (Admin Approval)
1. **Backend**: Retrieves stored `voterId`, `secretX`, `hashXp`
2. **Backend**: Signs message: `msgField = poseidon3([voterId, secretX, hashXp])`
3. **Backend**: Generates EdDSA signature using admin private key
4. **Backend**: Verifies signature using same `hashXp` value

### Proof Generation Flow (Frontend)
1. **Frontend**: Retrieves plain `Xp` from localStorage
2. **Frontend**: Gets signature from backend
3. **Frontend**: Computes circuit input with plain `Xp` (circuit internally hashes it)
4. **Circuit**: Verifies signature matches `poseidon3([ID, X, poseidon1([Xp])])`

## Testing

To verify the fix works:

1. **Start backend**: `cd backend && npm run start:dev`
2. **Start voter frontend**: `cd frontend && npm run dev`
3. **Generate credentials** in voter dashboard
4. **Submit registration** with documents
5. **Start admin dashboard**: `cd admin-dashboard && npm run dev`
6. **Login as admin** and approve the request
7. **Return to voter dashboard** and generate zkSNARK proof
8. **Verify proof locally and on-chain**

All steps should now work without signature verification errors.

## Database Migration Note

If you have existing data with `secretXp` column, you'll need to:
1. Drop the existing database or run migration
2. The entity change from `secretXp` to `hashXp` requires database schema update

For SQLite (development), simplest approach:
- Delete `backend/database.sqlite` file
- Backend will recreate with new schema on restart
