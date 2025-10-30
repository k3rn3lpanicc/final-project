const circomlibjs = require('circomlibjs');
const fs = require('fs');

async function signCircuitMessage() {
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
	
	// Use the EXACT message computed by the circuit
	const msgField = 14016310259661903985824184587962162159075853636241857805473685584817252057103n;
	console.log('Signing message computed by circuit:', msgField.toString());
	
	const msgBytes = toBytesLE32(msgField);
	
	const privKey = Buffer.from(
		'0001020304050607080900010203040506070809000102030405060708090001',
		'hex'
	);
	const pubKey = eddsa.prv2pub(privKey);
	const signature = eddsa.signPedersen(privKey, msgBytes);
	
	console.log('Verification:', eddsa.verifyPedersen(msgBytes, signature, pubKey));
	
	// Load current input and update signature
	const input = JSON.parse(fs.readFileSync('./input.json', 'utf8'));
	input.R8 = bytesToBitsLE(babyjub.packPoint(signature.R8));
	input.S = bytesToBitsLE(toBytesLE32(signature.S));
	input.A = bytesToBitsLE(babyjub.packPoint(pubKey));
	
	fs.writeFileSync('./input.json', JSON.stringify(input, null, 2));
	console.log('\n✅ Updated input.json with signature for circuit-computed message');
}

signCircuitMessage().catch(console.error);
