const circomlibjs = require('circomlibjs');
const fs = require('fs');

async function debug() {
	const poseidon = await circomlibjs.buildPoseidon();
	const eddsa = await circomlibjs.buildEddsa();
	const babyjub = await circomlibjs.buildBabyjub();
	
	// Read the input file
	const input = JSON.parse(fs.readFileSync('./input.json', 'utf8'));
	
	console.log('=== Debugging EdDSA Signature ===\n');
	
	// Reconstruct the message field from ID, X, Xp
	function FE(poseidonFn, arr) {
		const v = poseidonFn(arr);
		if (typeof v === 'bigint') return v;
		if (Array.isArray(v) && v.length === 1 && typeof v[0] === 'bigint') return v[0];
		// Handle byte arrays
		if (v instanceof Uint8Array || (Array.isArray(v) && v.every(n => typeof n === 'number'))) {
			let result = 0n;
			for (let i = 0; i < v.length; i++) {
				result += BigInt(v[i]) << (8n * BigInt(i));
			}
			return result;
		}
		throw new Error('Unexpected poseidon output type: ' + typeof v);
	}
	
	const ID = BigInt(input.ID);
	const X = BigInt(input.X);
	const Xp = BigInt(input.Xp);
	
	const hashXp = FE(poseidon, [Xp]);
	const msgField = FE(poseidon, [ID, X, hashXp]);
	
	console.log('Message field element:', msgField.toString());
	console.log('Message field in hex:', msgField.toString(16));
	
	// Convert to bits (LSB first, 254 bits)
	function bitsFromBigInt(n, length) {
		const out = [];
		let x = BigInt(n);
		for (let i = 0n; i < BigInt(length); i++) {
			out.push(Number((x >> i) & 1n));
		}
		return out;
	}
	
	const msgBits = bitsFromBigInt(msgField, 254);
	console.log('Message as 254 bits (first 32):', msgBits.slice(0, 32).join(''));
	
	// Convert bits to bytes
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
	
	const msgBytes = bitsToBytes(msgBits);
	console.log('Message as bytes:', Array.from(msgBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
	console.log('Message bytes length:', msgBytes.length);
	
	// Reconstruct A, R8, S from input
	function bitsToPoint(bits) {
		const bytes = bitsToBytes(bits);
		return babyjub.unpackPoint(bytes);
	}
	
	function bitsToBigInt(bits) {
		let val = 0n;
		for (let i = 0; i < bits.length; i++) {
			if (bits[i]) val |= (1n << BigInt(i));
		}
		return val;
	}
	
	const A = bitsToPoint(input.A);
	const R8 = bitsToPoint(input.R8);
	const S = bitsToBigInt(input.S);
	
	console.log('\nPublic key A:');
	console.log('  x:', A[0].toString());
	console.log('  y:', A[1].toString());
	
	console.log('\nSignature R8:');
	console.log('  x:', R8[0].toString());
	console.log('  y:', R8[1].toString());
	
	console.log('\nSignature S:', S.toString());
	
	// Try verifying with the bytes
	const signature = { R8, S };
	const isValid = eddsa.verifyPedersen(msgBytes, signature, A);
	console.log('\nVerification with msgBytes:', isValid);
	
	// Also try signing fresh with the same private key
	const issuerPrivKey = Buffer.from(
		'0001020304050607080900010203040506070809000102030405060708090001',
		'hex'
	);
	const freshSig = eddsa.signPedersen(issuerPrivKey, msgBytes);
	console.log('\nFresh signature:');
	console.log('  R8.x:', freshSig.R8[0].toString());
	console.log('  R8.y:', freshSig.R8[1].toString());
	console.log('  S:', freshSig.S.toString());
	
	const freshValid = eddsa.verifyPedersen(msgBytes, freshSig, A);
	console.log('Fresh signature valid:', freshValid);
	
	// Check if they match
	console.log('\nSignatures match:');
	console.log('  R8 match:', R8[0] === freshSig.R8[0] && R8[1] === freshSig.R8[1]);
	console.log('  S match:', S === freshSig.S);
}

debug().catch(console.error);
