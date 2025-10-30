const circomlibjs = require('circomlibjs');
const fs = require('fs');

async function createTest() {
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
	
	// Use the exact message from our circuit
	const msg = 20075336612696498612289537112885857651642013832881432971250351515435296128161n;
	const msgBytes = toBytesLE32(msg);
	
	const privKey = Buffer.from(
		'0001020304050607080900010203040506070809000102030405060708090001',
		'hex'
	);
	const pubKey = eddsa.prv2pub(privKey);
	const signature = eddsa.signPedersen(privKey, msgBytes);
	
	console.log('JS Verification:', eddsa.verifyPedersen(msgBytes, signature, pubKey));
	
	const input = {
		msg: msg.toString(),
		A: bytesToBitsLE(babyjub.packPoint(pubKey)),
		R8: bytesToBitsLE(babyjub.packPoint(signature.R8)),
		S: bytesToBitsLE(toBytesLE32(signature.S))
	};
	
	fs.writeFileSync('test2.json', JSON.stringify(input, null, 2));
	console.log('Saved test2.json');
}

createTest().catch(console.error);
