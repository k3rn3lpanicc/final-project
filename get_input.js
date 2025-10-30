const crypto = require('crypto');
const circomlibjs = require('circomlibjs');
const fs = require('fs');
const { execSync } = require('child_process');

// Helper function to convert a big integer to a 256-bit array (little-endian)
function bigIntToBits256(bigIntVal) {
	// Ensure we're working with a BigInt
	let val = BigInt(bigIntVal);
	const bits = [];

	// Convert to 256 bits (little-endian)
	for (let i = 0; i < 256; i++) {
		bits.push(Number(val & 1n));
		val = val >> 1n;
	}

	return bits;
}

function bytesToBigIntLE(bytes) {
	const a = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
	let x = 0n;
	for (let i = 0; i < a.length; i++) x += BigInt(a[i]) << (8n * BigInt(i));
	return x;
}

function toBytesLE32(n) {
	let x = BigInt(n);
	const out = new Uint8Array(32);
	for (let i = 0; i < 32; i++) out[i] = Number((x >> (8n * BigInt(i))) & 0xffn);
	return out;
}

// Convert bits (LSB first) to bytes (LSB first)
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
// bytes -> LSB-first bits
function bytesToBitsLE(bytes) {
	const bits = [];
	for (let i = 0; i < bytes.length; i++) {
		const b = bytes[i];
		for (let k = 0; k < 8; k++) bits.push((b >> k) & 1);
	}
	return bits; // length = bytes.length*8
}
// BigInt -> LSB-first bits of given length
function bitsFromBigInt(n, length) {
	const out = [];
	let x = BigInt(n);
	for (let i = 0n; i < BigInt(length); i++) out.push(Number((x >> i) & 1n));
	return out;
}
// Normalize poseidon output (some builds return [fe])
function FE(poseidonFn, arr) {
	const v = poseidonFn(arr);
	if (typeof v === 'bigint') return v;
	if (Array.isArray(v) && v.length === 1 && typeof v[0] === 'bigint') return v[0];
	// If it looks like a byte array, treat it as LE bytes
	if (
		v instanceof Uint8Array ||
		(Array.isArray(v) && v.every((n) => Number.isInteger(n) && n >= 0 && n < 256))
	) {
		return bytesToBigIntLE(v);
	}
	// Last resort: try decimal string
	if (v && typeof v.toString === 'function') {
		const s = v.toString();
		if (/^\d+$/.test(s)) return BigInt(s);
	}
	throw new Error('Unsupported Poseidon return type: ' + typeof v);
}

// Helper function to generate random BigInt within BN128 field
function generateRandomBigInt() {
	// BN128 field modulus
	const BN128_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
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
	const poseidon = await circomlibjs.buildPoseidon();
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

	// 3. Compute hashes using the circuit
	console.log('\nComputing Poseidon hashes using circuit...');
	
	// Write temporary input for circuit computation
	const tempInput = {
		ID: ID.toString(),
		X: X.toString(),
		Xp: Xp.toString(),
		electionId: electionId.toString()
	};
	fs.writeFileSync('./temp_compute_input.json', JSON.stringify(tempInput));
	
	// Run the compute_values circuit
	execSync('cd build\\compute_values_js && node generate_witness.js compute_values.wasm ..\\..\\temp_compute_input.json temp_witness.wtns', {stdio: 'inherit'});
	
	// Read the witness
	const snarkjs = require('snarkjs');
	const witness = await snarkjs.wtns.exportJson('./build/compute_values_js/temp_witness.wtns');
	const hashXp = witness[1];
	const msgField = witness[2];
	const nh = witness[3];
	
	console.log('Circuit-computed hashXp:', hashXp.toString());
	console.log('Circuit-computed msgField:', msgField.toString());
	console.log('Circuit-computed nullifier:', nh.toString());

	// 4. Sign the message field computed by the circuit
	const msgBytes = toBytesLE32(msgField);
	const signature = eddsa.signPedersen(issuerPrivKey, msgBytes);

	console.log('\nGenerated signature:');
	console.log('R8 [x, y]:', [signature.R8[0].toString(), signature.R8[1].toString()]);
	console.log('S:', signature.S.toString());

	const A_bits = bytesToBitsLE(babyjub.packPoint(issuerPubKey));
	const R8_bits = bytesToBitsLE(babyjub.packPoint(signature.R8));
	const S_bits = bytesToBitsLE(toBytesLE32(BigInt(signature.S)));

	// 5. Create the input object
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

	// 6. Verify the signature to ensure everything is correct
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
