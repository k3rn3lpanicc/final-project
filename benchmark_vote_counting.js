/**
 * Vote Counting Performance Benchmark
 *
 * This script benchmarks the complete voting lifecycle and measures vote counting performance:
 * 1. Deploys contracts (Verifier and Voting contract)
 * 2. Creates an election
 * 3. Casts 20,000 votes (each with ZK proof generation, encryption, and blockchain submission)
 * 4. Retrieves all votes from the blockchain
 * 5. Decrypts and counts all votes
 * 6. Reports average vote counting performance (votes/second)
 *
 * Prerequisites:
 * - Hardhat local node running on http://127.0.0.1:8545
 * - Compiled contracts in artifacts/contracts/
 * - Circuit files in build/VoteScheme_js/ and VoteScheme_final.zkey
 *
 * Usage: node benchmark_vote_counting.js
 */

import { ethers } from 'ethers';
import crypto from 'crypto';
import * as circomlibjs from 'circomlibjs';
import { poseidon1, poseidon3 } from 'poseidon-lite';
import * as snarkjs from 'snarkjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const NUM_VOTES = 1000;
const NUM_OPTIONS = 4;
const PARALLEL_BATCH_SIZE = 10; // Number of votes to submit in parallel (reduced to avoid memory issues)

// Election private key from decrypt_votes.js
const ELECTION_PRIVATE_KEY = BigInt(
	'250082668618633646334213584719494925374420844776732603861415520274085646643',
);

const ELECTION_PUBLIC_KEY = {
	x: BigInt('9350324229486977864199186023804174729698250325103440161239826812858536464745'),
	y: BigInt('418265988263166406135396573719470131816775157186488453786003049284275271736'),
};

// Admin private key for signing
const ADMIN_PRIVATE_KEY = Buffer.from(
	'f18a1ad9b6d2d7d9fc8e9f8c7e6d5c4b3a29180706050403020100fffefdfcfbfaf9f8',
	'hex',
);

// Load contract ABIs
const electionABI = JSON.parse(
	fs.readFileSync(path.join(__dirname, 'contracts', 'ElectionABI.json'), 'utf8'),
);

// Utility functions
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

function generateRandomBigInt() {
	const BN128_FIELD =
		21888242871839275222246405745257275088548364400416034343698204186575808495617n;
	let val;
	do {
		val = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
	} while (val >= BN128_FIELD);
	return val;
}

/**
 * Derives an AES key from a shared secret point using SHA-256
 */
function deriveAESKey(sharedSecretX) {
	const sharedBytes = Buffer.alloc(32);
	const hexStr = sharedSecretX.toString(16).padStart(64, '0');
	for (let i = 0; i < 32; i++) {
		sharedBytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
	}
	return crypto.createHash('sha256').update(sharedBytes).digest();
}

/**
 * Encrypts a vote using ECDH + AES-GCM
 */
async function encryptVote(optionIndex, nonce, publicKey, babyjub) {
	// Message format: optionIndex|nonce
	const message = `${optionIndex}|${nonce}`;
	const messageBuffer = Buffer.from(message, 'utf8');

	// Generate ephemeral key pair
	const r = generateRandomBigInt() % babyjub.subOrder;
	const R = babyjub.mulPointEscalar(babyjub.Base8, r);

	// Compute shared secret S = r * PublicKey
	// Convert publicKey BigInts to field elements
	const F = babyjub.F;
	const pubKeyPoint = [F.e(publicKey.x), F.e(publicKey.y)];
	const sharedSecret = babyjub.mulPointEscalar(pubKeyPoint, r);

	// Get shared secret X coordinate as BigInt
	const sharedSecretX = BigInt(F.toObject(sharedSecret[0]));
	const aesKey = deriveAESKey(sharedSecretX);

	// Encrypt using AES-GCM
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);

	let encrypted = cipher.update(messageBuffer);
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	const tag = cipher.getAuthTag();

	// Combine: R_x (32 bytes) + R_y (32 bytes) + IV (12 bytes) + ciphertext + tag (16 bytes)
	const R_x = F.toObject(R[0]);
	const R_y = F.toObject(R[1]);
	const R_x_bytes = Buffer.from(R_x.toString(16).padStart(64, '0'), 'hex');
	const R_y_bytes = Buffer.from(R_y.toString(16).padStart(64, '0'), 'hex');

	const combined = Buffer.concat([R_x_bytes, R_y_bytes, iv, encrypted, tag]);

	return '0x' + combined.toString('hex');
}

/**
 * Decrypts a vote encrypted with ECDH + AES-GCM
 */
async function decryptVote(encryptedData, privateKey) {
	const bjj = await circomlibjs.buildBabyjub();

	const hexData = encryptedData.startsWith('0x') ? encryptedData.slice(2) : encryptedData;

	// Parse components
	const R_x = BigInt('0x' + hexData.slice(0, 64));
	const R_y = BigInt('0x' + hexData.slice(64, 128));
	const iv = Buffer.from(hexData.slice(128, 152), 'hex');
	const ciphertextAndTag = Buffer.from(hexData.slice(152), 'hex');
	const ciphertext = ciphertextAndTag.slice(0, -16);
	const tag = ciphertextAndTag.slice(-16);

	// Compute shared secret S = privKey * R
	const F = bjj.F;
	const R = [F.e(R_x), F.e(R_y)];
	const sharedSecret = bjj.mulPointEscalar(R, privateKey);

	// Derive AES key - extract BigInt from field element
	const sharedSecretX = BigInt(F.toObject(sharedSecret[0]));
	const aesKey = deriveAESKey(sharedSecretX);

	// Decrypt
	const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
	decipher.setAuthTag(tag);

	let decrypted = decipher.update(ciphertext);
	decrypted = Buffer.concat([decrypted, decipher.final()]);

	const message = decrypted.toString('utf8');
	const [optionIndex, nonce] = message.split('|');

	return { optionIndex: parseInt(optionIndex), nonce };
}

/**
 * Generates a ZK proof for a vote
 */
async function generateProof(eddsa, babyjub, issuerPrivKey, issuerPubKey, electionId) {
	// Generate voter credentials
	const ID = generateRandomBigInt();
	const X = generateRandomBigInt();
	const Xp = generateRandomBigInt();

	// Compute message hash
	const hashXp = poseidon1([Xp]);
	const msgField = poseidon3([ID, X, hashXp]);

	// Sign the message
	const msgBytes = toBytesLE32(msgField);
	const signature = eddsa.signPedersen(issuerPrivKey, msgBytes);

	// Convert to bits for circuit
	const A_bits = bytesToBitsLE(babyjub.packPoint(issuerPubKey));
	const R8_bits = bytesToBitsLE(babyjub.packPoint(signature.R8));
	const S_bits = bytesToBitsLE(toBytesLE32(BigInt(signature.S)));

	// Compute nullifier hash: Poseidon(X, Xp, electionId)
	const nullifierHash = poseidon3([X, Xp, electionId]);

	const circuitInput = {
		nh: nullifierHash.toString(),
		electionId: electionId.toString(),
		A: A_bits,
		ID: ID.toString(),
		X: X.toString(),
		Xp: Xp.toString(),
		R8: R8_bits,
		S: S_bits,
	};

	const wasmPath = path.join(__dirname, 'build', 'VoteScheme_js', 'VoteScheme.wasm');
	const zkeyPath = path.join(__dirname, 'VoteScheme_final.zkey');

	const { proof, publicSignals } = await snarkjs.groth16.fullProve(
		circuitInput,
		wasmPath,
		zkeyPath,
	);

	return { proof, publicSignals, nullifierHash };
}

/**
 * Formats proof for Solidity verifier
 */
function formatProofForSolidity(proof, publicSignals) {
	const pA = [proof.pi_a[0], proof.pi_a[1]];
	const pB = [
		[proof.pi_b[0][1], proof.pi_b[0][0]],
		[proof.pi_b[1][1], proof.pi_b[1][0]],
	];
	const pC = [proof.pi_c[0], proof.pi_c[1]];
	const pubSignals = publicSignals.map((s) => BigInt(s));

	return { pA, pB, pC, pubSignals };
}

/**
 * Main benchmark function
 */
async function runBenchmark() {
	console.log('========================================');
	console.log('Vote Counting Performance Benchmark');
	console.log('========================================\n');

	console.log(`Configuration:`);
	console.log(`  Number of votes: ${NUM_VOTES.toLocaleString()}`);
	console.log(`  Number of options: ${NUM_OPTIONS}`);
	console.log(`  Blockchain: Hardhat Local Node\n`);

	// Initialize cryptographic primitives
	console.log('Initializing cryptographic libraries...');
	const eddsa = await circomlibjs.buildEddsa();
	const babyjub = await circomlibjs.buildBabyjub();
	const issuerPubKey = eddsa.prv2pub(ADMIN_PRIVATE_KEY);
	console.log('Done.\n');

	// Connect to Hardhat node
	const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
	const signer = await provider.getSigner(0);

	// Deploy contracts
	console.log('Deploying contracts...');

	// Load contract factories
	const helperArtifact = JSON.parse(
		fs.readFileSync(
			path.join(
				__dirname,
				'artifacts',
				'contracts',
				'VoteSchemeHelper.sol',
				'ProofHelper.json',
			),
			'utf8',
		),
	);
	const verifierArtifact = JSON.parse(
		fs.readFileSync(
			path.join(
				__dirname,
				'artifacts',
				'contracts',
				'VoteSchemeVerifier.sol',
				'Groth16Verifier.json',
			),
			'utf8',
		),
	);
	const votingArtifact = JSON.parse(
		fs.readFileSync(
			path.join(__dirname, 'artifacts', 'contracts', 'Election.sol', 'ZKVoting.json'),
			'utf8',
		),
	);

	// Deploy ProofHelper first
	const ProofHelper = new ethers.ContractFactory(
		helperArtifact.abi,
		helperArtifact.bytecode,
		signer,
	);
	const helper = await ProofHelper.deploy();
	await helper.waitForDeployment();
	const helperAddress = await helper.getAddress();

	// Deploy Groth16Verifier with helper address
	const Groth16Verifier = new ethers.ContractFactory(
		verifierArtifact.abi,
		verifierArtifact.bytecode,
		signer,
	);
	const verifier = await Groth16Verifier.deploy(helperAddress);
	await verifier.waitForDeployment();
	const verifierAddress = await verifier.getAddress();

	// Deploy ZKVoting
	const ZKVoting = new ethers.ContractFactory(
		votingArtifact.abi,
		votingArtifact.bytecode,
		signer,
	);
	const voting = await ZKVoting.deploy();
	await voting.waitForDeployment();
	const votingAddress = await voting.getAddress();

	console.log(`  Verifier deployed at: ${verifierAddress}`);
	console.log(`  Voting contract deployed at: ${votingAddress}\n`);

	// Create election
	console.log('Creating election...');
	const electionId = BigInt(Math.floor(Math.random() * 1000000));

	let tx = await voting.createElection(electionId, verifierAddress, true);
	await tx.wait();

	// Note: Not binding issuer public key (issuerBound = false by default)
	// This allows any valid proof to be submitted
	console.log(`  Election ID: ${electionId}`);
	console.log('Done.\n');

	// Cast votes in parallel batches
	console.log(
		`Casting ${NUM_VOTES.toLocaleString()} votes (${PARALLEL_BATCH_SIZE} at a time)...`,
	);
	const voteData = [];
	const startCasting = Date.now();

	const submitSingleVote = async (index) => {
		const optionIndex = Math.floor(Math.random() * NUM_OPTIONS);
		const nonce = Math.floor(Math.random() * 1000000);

		// Generate proof (with fresh credentials each time)
		const { proof, publicSignals, nullifierHash } = await generateProof(
			eddsa,
			babyjub,
			ADMIN_PRIVATE_KEY,
			issuerPubKey,
			electionId,
		);

		const { pA, pB, pC, pubSignals } = formatProofForSolidity(proof, publicSignals);

		// Encrypt vote
		const encryptedVote = await encryptVote(optionIndex, nonce, ELECTION_PUBLIC_KEY, babyjub);

		// Submit vote
		try {
			const tx = await voting.submitVote(pA, pB, pC, pubSignals, encryptedVote);
			await tx.wait();
			return { optionIndex, encryptedVote };
		} catch (error) {
			console.error(`\n\nError submitting vote ${index + 1}:`);
			console.error('Error:', error.message);
			throw error;
		}
	};

	// Submit votes in batches
	for (let batch = 0; batch < NUM_VOTES; batch += PARALLEL_BATCH_SIZE) {
		const batchSize = Math.min(PARALLEL_BATCH_SIZE, NUM_VOTES - batch);
		const promises = [];

		for (let i = 0; i < batchSize; i++) {
			promises.push(submitSingleVote(batch + i));
		}

		const results = await Promise.all(promises);
		voteData.push(...results);

		const completed = batch + batchSize;
		const elapsed = ((Date.now() - startCasting) / 1000).toFixed(2);
		const rate = ((completed / (Date.now() - startCasting)) * 1000).toFixed(2);
		process.stdout.write(
			`\r  Progress: ${completed}/${NUM_VOTES} votes cast (${elapsed}s, ${rate} votes/sec)`,
		);
	}

	const castingTime = (Date.now() - startCasting) / 1000;
	console.log('\nDone.\n');

	// Retrieve and decrypt votes
	console.log('Counting votes...');
	const startCounting = Date.now();

	// Get all VoteSubmitted events
	const filter = voting.filters.VoteSubmitted(electionId);
	const events = await voting.queryFilter(filter);

	console.log(`  Retrieved ${events.length} vote events`);

	// Decrypt and count votes in parallel
	const voteCounts = new Array(NUM_OPTIONS).fill(0);
	let validVotes = 0;
	let invalidVotes = 0;

	// Process votes in parallel batches to maximize decryption speed
	const DECRYPTION_BATCH_SIZE = 100; // Process 100 votes at a time

	for (let i = 0; i < events.length; i += DECRYPTION_BATCH_SIZE) {
		const batch = events.slice(i, Math.min(i + DECRYPTION_BATCH_SIZE, events.length));

		const results = await Promise.all(
			batch.map(async (event) => {
				try {
					const encryptedVote = event.args.encryptedVote;
					const { optionIndex } = await decryptVote(encryptedVote, ELECTION_PRIVATE_KEY);

					if (optionIndex >= 0 && optionIndex < NUM_OPTIONS) {
						return { valid: true, optionIndex };
					} else {
						return { valid: false };
					}
				} catch (error) {
					return { valid: false };
				}
			}),
		);

		// Count the results from this batch
		for (const result of results) {
			if (result.valid) {
				voteCounts[result.optionIndex]++;
				validVotes++;
			} else {
				invalidVotes++;
			}
		}

		// Progress update
		const processed = Math.min(i + DECRYPTION_BATCH_SIZE, events.length);
		const elapsed = ((Date.now() - startCounting) / 1000).toFixed(2);
		const rate = ((processed / (Date.now() - startCounting)) * 1000).toFixed(2);
		process.stdout.write(
			`\r  Progress: ${processed}/${events.length} votes counted (${elapsed}s, ${rate} votes/sec)`,
		);
	}

	const countingTime = (Date.now() - startCounting) / 1000;
	const votesPerSecond = (events.length / countingTime).toFixed(2);

	console.log('Done.\n');

	// Display results
	console.log('========================================');
	console.log('Results');
	console.log('========================================\n');

	console.log('Voting Phase:');
	console.log(`  Total votes cast: ${NUM_VOTES.toLocaleString()}`);
	console.log(`  Time taken: ${castingTime.toFixed(2)} seconds`);
	console.log(`  Average rate: ${(NUM_VOTES / castingTime).toFixed(2)} votes/second\n`);

	console.log('Counting Phase:');
	console.log(`  Total votes retrieved: ${events.length.toLocaleString()}`);
	console.log(`  Valid votes: ${validVotes.toLocaleString()}`);
	console.log(`  Invalid votes: ${invalidVotes.toLocaleString()}`);
	console.log(`  Time taken: ${countingTime.toFixed(2)} seconds`);
	console.log(`  Counting rate: ${votesPerSecond} votes/second\n`);

	console.log('Vote Distribution:');
	for (let i = 0; i < NUM_OPTIONS; i++) {
		const percentage = ((voteCounts[i] / validVotes) * 100).toFixed(2);
		console.log(`  Option ${i}: ${voteCounts[i].toLocaleString()} votes (${percentage}%)`);
	}

	console.log('\n========================================');
	console.log('Summary');
	console.log('========================================\n');

	console.log(`Vote counting performance: ${votesPerSecond} votes/second`);
	console.log(
		`Total benchmark time: ${((Date.now() - startCasting + castingTime * 1000) / 1000).toFixed(2)} seconds`,
	);
}

// Run the benchmark
runBenchmark()
	.then(() => {
		console.log('\nBenchmark completed successfully.');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\nBenchmark failed:', error);
		process.exit(1);
	});
