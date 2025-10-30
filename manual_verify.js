const circomlibjs = require('circomlibjs');
const fs = require('fs');

async function checkEdDSAManually() {
	const poseidon = await circomlibjs.buildPoseidon();
	const eddsa = await circomlibjs.buildEddsa();
	const babyjub = await circomlibjs.buildBabyjub();
	const F = babyjub.F;
	
	// Helper functions
	function FE(poseidonFn, arr) {
		const v = poseidonFn(arr);
		if (typeof v === 'bigint') return v;
		if (Array.isArray(v) && v.length === 1 && typeof v[0] === 'bigint') return v[0];
		if (v instanceof Uint8Array || (Array.isArray(v) && v.every(n => typeof n === 'number'))) {
			let result = 0n;
			for (let i = 0; i < v.length; i++) {
				result += BigInt(v[i]) << (8n * BigInt(i));
			}
			return result;
		}
		throw new Error('Unexpected poseidon output type');
	}
	
	function toBytesLE32(n) {
		let x = BigInt(n);
		const out = new Uint8Array(32);
		for (let i = 0; i < 32; i++) out[i] = Number((x >> (8n * BigInt(i))) & 0xffn);
		return out;
	}
	
	function bitsToBytes(bits) {
		const numBytes = Math.ceil(bits.length / 8);
		const bytes = new Uint8Array(numBytes);
		for (let i = 0; i < bits.length; i++) {
			const byteIdx = Math.floor(i / 8);
			const bitIdx = i % 8;
			if (bits[i]) bytes[byteIdx] |= (1 << bitIdx);
		}
		return bytes;
	}
	
	function bytesToBigIntLE(bytes) {
		let x = 0n;
		for (let i = 0; i < bytes.length; i++) x += BigInt(bytes[i]) << (8n * BigInt(i));
		return x;
	}
	
	// Read input
	const input = JSON.parse(fs.readFileSync('./input.json', 'utf8'));
	
	// Recompute message
	const ID = BigInt(input.ID);
	const X = BigInt(input.X);
	const Xp = BigInt(input.Xp);
	const hashXp = FE(poseidon, [Xp]);
	const msgField = FE(poseidon, [ID, X, hashXp]);
	const msgBytes = toBytesLE32(msgField);
	
	// Get signature components
	const A_bytes = bitsToBytes(input.A);
	const R8_bytes = bitsToBytes(input.R8);
	const S_bytes = bitsToBytes(input.S);
	
	const A = babyjub.unpackPoint(A_bytes);
	const R8 = babyjub.unpackPoint(R8_bytes);
	const S = bytesToBigIntLE(S_bytes);
	
	console.log('=== Manual EdDSA Verification ===\n');
	console.log('Message field:', msgField.toString());
	console.log('A:', [F.toString(A[0]), F.toString(A[1])]);
	console.log('R8:', [F.toString(R8[0]), F.toString(R8[1])]);
	console.log('S:', S.toString());
	
	// Step 1: Compute h = Pedersen(R8_packed || A_packed || msg)
	const composeBuff = new Uint8Array(32 + 32 + msgBytes.length);
	composeBuff.set(babyjub.packPoint(R8), 0);
	composeBuff.set(babyjub.packPoint(A), 32);
	composeBuff.set(msgBytes, 64);
	
	console.log('\nPedersen input (bytes):', composeBuff.length);
	
	const pedersenHash = eddsa.pedersenHash;
	const hmBuff = pedersenHash.hash(composeBuff);
	const hm = bytesToBigIntLE(hmBuff);
	
	console.log('h (from Pedersen):', hm.toString());
	
	// Step 2: Compute 8*A
	let A8 = babyjub.addPoint(A, A);  // 2*A
	A8 = babyjub.addPoint(A8, A8);     // 4*A
	A8 = babyjub.addPoint(A8, A8);     // 8*A
	
	console.log('8*A:', [F.toString(A8[0]), F.toString(A8[1])]);
	
	// Step 3: Compute h*8*A
	const hA8 = babyjub.mulPointEscalar(A8, hm);
	console.log('h*8*A:', [F.toString(hA8[0]), F.toString(hA8[1])]);
	
	// Step 4: Compute right = R8 + h*8*A
	const right = babyjub.addPoint(R8, hA8);
	console.log('R8 + h*8*A:', [F.toString(right[0]), F.toString(right[1])]);
	
	// Step 5: Compute left = S*B8
	const BASE8 = [
		5299619240641551281634865583518297030282874472190772894086521144482721001553n,
		16950150798460657717958625567821834550301663161624707787222815936182638968203n
	];
	// Convert S to a buffer for mulPointEscalar
	const sBuffer = toBytesLE32(S);
	const left = babyjub.mulPointEscalar(BASE8, sBuffer);
	console.log('S*B8:', [F.toString(left[0]), F.toString(left[1])]);
	
	// Check equality
	const valid = F.eq(left[0], right[0]) && F.eq(left[1], right[1]);
	console.log('\n✅ Verification:', valid);
	
	if (!valid) {
		console.log('\n❌ ERROR: Manual verification failed!');
		console.log('Left vs Right:');
		console.log('  X match:', F.eq(left[0], right[0]));
		console.log('  Y match:', F.eq(left[1], right[1]));
	}
}

checkEdDSAManually().catch(console.error);
