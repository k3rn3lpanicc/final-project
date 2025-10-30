const circomlibjs = require('circomlibjs');
const fs = require('fs');

async function comparePoseidon() {
	const poseidon = await circomlibjs.buildPoseidon();
	
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
	
	// Load input
	const input = JSON.parse(fs.readFileSync('./input.json', 'utf8'));
	
	const ID = BigInt(input.ID);
	const X = BigInt(input.X);
	const Xp = BigInt(input.Xp);
	
	// Compute hashes
	const hashXp = FE(poseidon, [Xp]);
	const msgField = FE(poseidon, [ID, X, hashXp]);
	
	console.log('JS Poseidon computation:');
	console.log('  hashXp:', hashXp.toString());
	console.log('  msgField:', msgField.toString());
	
	// Now let's sign this exact msgField and update input.json
	const eddsa = await circomlibjs.buildEddsa();
	const babyjub = await circomlibjs.buildBabyjub();
	
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
	
	const msgBytes = toBytesLE32(msgField);
	
	const privKey = Buffer.from(
		'0001020304050607080900010203040506070809000102030405060708090001',
		'hex'
	);
	const pubKey = eddsa.prv2pub(privKey);
	const signature = eddsa.signPedersen(privKey, msgBytes);
	
	console.log('\nSignature verification:', eddsa.verifyPedersen(msgBytes, signature, pubKey));
	
	// Update input.json with the correct signature
	input.R8 = bytesToBitsLE(babyjub.packPoint(signature.R8));
	input.S = bytesToBitsLE(toBytesLE32(signature.S));
	input.A = bytesToBitsLE(babyjub.packPoint(pubKey));
	
	fs.writeFileSync('./input.json', JSON.stringify(input, null, 2));
	console.log('\n✅ Updated input.json with correct signature for the computed message');
}

comparePoseidon().catch(console.error);
