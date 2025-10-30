const circomlibjs = require('circomlibjs');
const fs = require('fs');

async function testVoteScheme() {
	const poseidon = await circomlibjs.buildPoseidon();
	const eddsa = await circomlibjs.buildEddsa();
	const babyjub = await circomlibjs.buildBabyjub();
	
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
	
	function bytesToBitsLE(bytes) {
		const bits = [];
		for (let i = 0; i < bytes.length; i++) {
			const b = bytes[i];
			for (let k = 0; k < 8; k++) bits.push((b >> k) & 1);
		}
		return bits;
	}
	
	// Read current input
	const input = JSON.parse(fs.readFileSync('./input.json', 'utf8'));
	
	const ID = BigInt(input.ID);
	const X = BigInt(input.X);
	const Xp = BigInt(input.Xp);
	
	// Recompute what the circuit computes
	const hashXp = FE(poseidon, [Xp]);
	const msgField = FE(poseidon, [ID, X, hashXp]);
	
	console.log('=== Circuit Computation ===');
	console.log('ID:', ID.toString());
	console.log('X:', X.toString());
	console.log('Xp:', Xp.toString());
	console.log('hashXp:', hashXp.toString());
	console.log('msgField:', msgField.toString());
	console.log('msgField hex:', msgField.toString(16));
	
	// Check if msgField is within BN128 field
	const BN128_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
	console.log('\nmsgField < BN128 field:', msgField < BN128_FIELD);
	
	// Convert to bytes - this is what should be signed
	const msgBytes = toBytesLE32(msgField);
	console.log('\nmsgBytes (hex):', Array.from(msgBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
	
	// Get key from input
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
	
	const A_bytes = bitsToBytes(input.A);
	const R8_bytes = bitsToBytes(input.R8);
	const S_bytes = bitsToBytes(input.S);
	
	const A = babyjub.unpackPoint(A_bytes);
	const R8 = babyjub.unpackPoint(R8_bytes);
	
	function bytesToBigIntLE(bytes) {
		let x = 0n;
		for (let i = 0; i < bytes.length; i++) x += BigInt(bytes[i]) << (8n * BigInt(i));
		return x;
	}
	const S = bytesToBigIntLE(S_bytes);
	
	console.log('\n=== Signature from input.json ===');
	console.log('A:', [A[0].toString(), A[1].toString()]);
	console.log('R8:', [R8[0].toString(), R8[1].toString()]);
	console.log('S:', S.toString());
	
	// Verify the signature
	const signature = { R8, S };
	const isValid = eddsa.verifyPedersen(msgBytes, signature, A);
	console.log('\n✅ Signature verification:', isValid);
	
	if (!isValid) {
		console.log('\n❌ ERROR: Signature does not verify!');
		console.log('This means the input.json was not generated correctly for the circuit.');
	}
}

testVoteScheme().catch(console.error);
