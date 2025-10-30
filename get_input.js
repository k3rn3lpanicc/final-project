const crypto = require('crypto');
const circomlibjs = require('circomlibjs');
const fs = require('fs');
const { poseidon1, poseidon3 } = require('poseidon-lite');

function toBytesLE32(n) {
	let x = BigInt(n);
	const out = new Uint8Array(32);
	for (let i = 0; i < 32; i++) out[i] = Number((x >> (8n * BigInt(i))) & 0xffn);
	return out;
}

// bytes -> LSB-first bits
function bytesToBitsLE(bytes) {
	const bits = [];
	for (let i = 0; i < bytes.length; i++) {
		const b = bytes[i];
		for (let k = 0; k < 8; k++) bits.push((b >> k) & 1);
	}
	return bits; // length = bytes.length*8
}

// Helper function to generate random BigInt within BN128 field
function generateRandomBigInt() {
	// BN128 field modulus
	const BN128_FIELD =
		21888242871839275222246405745257275088548364400416034343698204186575808495617n;
	// Generate random value less than the field
	let val;
	do {
		val = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
	} while (val >= BN128_FIELD);
	return val;
}

async function generateVoteInputs() {
	console.log('Generating inputs for VoteScheme circuit...');

	// Initialize circomlibjs components
	const eddsa = await circomlibjs.buildEddsa();
	const babyjub = await circomlibjs.buildBabyjub();

	// 1. Generate random private inputs
	const ID = generateRandomBigInt();
	const X = generateRandomBigInt();
	const Xp = generateRandomBigInt();
	const electionId = generateRandomBigInt();

	console.log('Generated random values:');
	console.log('ID:', ID.toString());
	console.log('X:', X.toString());
	console.log('Xp:', Xp.toString());
	console.log('electionId:', electionId.toString());

	// 2. Generate issuer's key pair
	const issuerPrivKey = Buffer.from(
		'0001020304050607080900010203040506070809000102030405060708090001',
		'hex'
	);
	const issuerPubKey = eddsa.prv2pub(issuerPrivKey);

	console.log('\nGenerated issuer key pair:');
	console.log('Private key (hex):', issuerPrivKey.toString('hex'));
	console.log('Public key [x, y]:', [issuerPubKey[0].toString(), issuerPubKey[1].toString()]);

	// 3. Compute hashes using poseidon-lite (matches circomlib v2)
	const hashXp = poseidon1([Xp]);
	console.log('\nComputed hashXp:', hashXp.toString());

	// 4. Compute message = Poseidon(ID, X, hashXp)
	const msgField = poseidon3([ID, X, hashXp]);
	console.log('Computed msgField:', msgField.toString());

	// 5. Sign the message
	const msgBytes = toBytesLE32(msgField);
	const signature = eddsa.signPedersen(issuerPrivKey, msgBytes);

	console.log('\nGenerated signature:');
	console.log('R8 [x, y]:', [signature.R8[0].toString(), signature.R8[1].toString()]);
	console.log('S:', signature.S.toString());

	const A_bits = bytesToBitsLE(babyjub.packPoint(issuerPubKey));
	const R8_bits = bytesToBitsLE(babyjub.packPoint(signature.R8));
	const S_bits = bytesToBitsLE(toBytesLE32(BigInt(signature.S)));

	// 6. Compute nullifier hash = Poseidon(X, Xp, electionId)
	const nh = poseidon3([X, Xp, electionId]);
	console.log('\nComputed nullifier:', nh.toString());

	// 7. Create the input object
	const inputJson = {
		nh: nh.toString(),
		electionId: electionId.toString(),
		A: A_bits,
		ID: ID.toString(),
		X: X.toString(),
		Xp: Xp.toString(),
		R8: R8_bits,
		S: S_bits,
	};

	// 8. Verify the signature to ensure everything is correct
	const isValid = eddsa.verifyPedersen(msgBytes, signature, issuerPubKey);
	console.log('\nSignature verification result:', isValid);

	if (!isValid) {
		throw new Error('Generated signature is invalid!');
	}

	return inputJson;
}

// Generate and save the inputs
async function main() {
	try {
		const inputs = await generateVoteInputs();

		const fs = require('fs');
		fs.writeFileSync('./input.json', JSON.stringify(inputs, null, 2));
		console.log('\n✅ Input file "input.json" generated successfully!');
		console.log('\nInput structure:');
		console.log('- nh: nullifier hash (public)');
		console.log('- electionId: election context (public)');
		console.log('- A: public key as 256-bit array (public)');
		console.log('- ID: voter identifier (private)');
		console.log('- X, Xp: private values (private)');
		console.log('- R8, S: signature components as 256-bit arrays (private)');

		// Print a sample of the arrays to verify they're correct
		console.log('\nSample of generated arrays (first 10 elements):');
		console.log('A (first 10 bits):', inputs.A.slice(0, 10));
		console.log('R8 (first 10 bits):', inputs.R8.slice(0, 10));
		console.log('S (first 10 bits):', inputs.S.slice(0, 10));
	} catch (error) {
		console.error('Error generating inputs:', error);
	}
}

// Run the main function
main();
