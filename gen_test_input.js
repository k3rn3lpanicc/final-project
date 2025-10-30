const circomlibjs = require('circomlibjs');
const fs = require('fs');

async function test() {
	const eddsa = await circomlibjs.buildEddsa();
	const babyjub = await circomlibjs.buildBabyjub();
	
	// Simple test message
	const msg = BigInt(1234567890);
	
	// Convert to 32 bytes LE
	function toBytesLE32(n) {
		let x = BigInt(n);
		const out = new Uint8Array(32);
		for (let i = 0; i < 32; i++) out[i] = Number((x >> (8n * BigInt(i))) & 0xffn);
		return out;
	}
	
	const msgBytes = toBytesLE32(msg);
	console.log('Message:', msg.toString());
	console.log('Message bytes:', Array.from(msgBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
	
	// Generate key pair
	const privKey = Buffer.from(
		'0001020304050607080900010203040506070809000102030405060708090001',
		'hex'
	);
	const pubKey = eddsa.prv2pub(privKey);
	
	// Sign
	const signature = eddsa.signPedersen(privKey, msgBytes);
	console.log('\nSignature:');
	console.log('  R8.x:', signature.R8[0].toString());
	console.log('  R8.y:', signature.R8[1].toString());
	console.log('  S:', signature.S.toString());
	
	// Verify
	const valid = eddsa.verifyPedersen(msgBytes, signature, pubKey);
	console.log('\nVerification:', valid);
	
	// Convert to bits for circuit
	function bytesToBitsLE(bytes) {
		const bits = [];
		for (let i = 0; i < bytes.length; i++) {
			const b = bytes[i];
			for (let k = 0; k < 8; k++) bits.push((b >> k) & 1);
		}
		return bits;
	}
	
	const A_bits = bytesToBitsLE(babyjub.packPoint(pubKey));
	const R8_bits = bytesToBitsLE(babyjub.packPoint(signature.R8));
	const S_bits = bytesToBitsLE(toBytesLE32(signature.S));
	
	const input = {
		msg: msg.toString(),
		A: A_bits,
		R8: R8_bits,
		S: S_bits
	};
	
	fs.writeFileSync('test_input.json', JSON.stringify(input, null, 2));
	console.log('\n✅ Test input saved to test_input.json');
}

test().catch(console.error);
