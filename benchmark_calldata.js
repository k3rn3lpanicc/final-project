import hre from 'hardhat';
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

async function generateProof(eddsa, babyjub, issuerPrivKey, issuerPubKey, electionId) {
	const ID = generateRandomBigInt();
	const X = generateRandomBigInt();
	const Xp = generateRandomBigInt();

	const hashXp = poseidon1([Xp]);
	const msgField = poseidon3([ID, X, hashXp]);

	const msgBytes = toBytesLE32(msgField);
	const signature = eddsa.signPedersen(issuerPrivKey, msgBytes);

	const A_bits = bytesToBitsLE(babyjub.packPoint(issuerPubKey));
	const R8_bits = bytesToBitsLE(babyjub.packPoint(signature.R8));
	const S_bits = bytesToBitsLE(toBytesLE32(BigInt(signature.S)));

	const nh = poseidon3([X, Xp, electionId]);

	const input = {
		nh: nh.toString(),
		electionId: electionId.toString(),
		A: A_bits,
		ID: ID.toString(),
		X: X.toString(),
		Xp: Xp.toString(),
		R8: R8_bits,
		S: S_bits,
	};

	const { proof, publicSignals } = await snarkjs.groth16.fullProve(
		input,
		'./build/VoteScheme_js/VoteScheme.wasm',
		'./VoteScheme_final.zkey',
	);

	return { proof, publicSignals };
}

function formatProofForSolidity(proof) {
	return {
		pA: [proof.pi_a[0], proof.pi_a[1]],
		pB: [
			[proof.pi_b[0][1], proof.pi_b[0][0]],
			[proof.pi_b[1][1], proof.pi_b[1][0]],
		],
		pC: [proof.pi_c[0], proof.pi_c[1]],
	};
}

async function encryptVote(babyjub, optionIndex, publicKeyBytes) {
	const nonce = generateRandomBigInt();
	const message = `${optionIndex}:${nonce}`;
	const messageBytes = Buffer.from(message, 'utf8');

	if (publicKeyBytes.length !== 32) {
		throw new Error('Public key must be 32 bytes');
	}

	const sharedSecret = crypto.randomBytes(32);
	const cipher = crypto.createCipheriv('aes-256-cbc', sharedSecret, sharedSecret.slice(0, 16));
	let encrypted = cipher.update(messageBytes);
	encrypted = Buffer.concat([encrypted, cipher.final()]);

	const pointX = babyjub.F.fromObject(publicKeyBytes);
	const ephemeralPriv = generateRandomBigInt();
	const ephemeralPub = babyjub.mulPointEscalar(babyjub.Base8, ephemeralPriv);
	const ephemeralPubPacked = babyjub.packPoint(ephemeralPub);

	return '0x' + Buffer.concat([Buffer.from(ephemeralPubPacked), encrypted]).toString('hex');
}

async function benchmark() {
	console.log('='.repeat(70));
	console.log('             BLOCKCHAIN CALLDATA SIZE BENCHMARK');
	console.log('='.repeat(70));
	console.log('');

	console.log('[INFO] Connecting to Hardhat node at http://127.0.0.1:8545');
	console.log('[INFO] Deploying contracts...');
	console.log('');

	const { buildEddsa, buildBabyjub } = circomlibjs;
	const eddsa = await buildEddsa();
	const babyjub = await buildBabyjub();

	const issuerPrivKey = Buffer.from(
		'0001020304050607080900010203040506070809000102030405060708090001',
		'hex',
	);
	const issuerPubKey = eddsa.prv2pub(issuerPrivKey);

	// Setup provider and signer
	const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
	
	// Get accounts from provider
	const accounts = await provider.listAccounts();
	if (accounts.length === 0) {
		throw new Error('No accounts available on Hardhat node');
	}
	
	const signer = await provider.getSigner(0);
	console.log(`[INFO] Using account: ${await signer.getAddress()}`);

	// Load compiled contracts
	const helperArtifact = JSON.parse(
		fs.readFileSync(
			path.join(__dirname, 'artifacts/contracts/VoteSchemeHelper.sol/ProofHelper.json'),
			'utf8',
		),
	);
	const verifierArtifact = JSON.parse(
		fs.readFileSync(
			path.join(__dirname, 'artifacts/contracts/VoteSchemeVerifier.sol/Groth16Verifier.json'),
			'utf8',
		),
	);
	const zkVotingArtifact = JSON.parse(
		fs.readFileSync(
			path.join(__dirname, 'artifacts/contracts/Election.sol/ZKVoting.json'),
			'utf8',
		),
	);

	// Deploy Helper
	const HelperFactory = new ethers.ContractFactory(
		helperArtifact.abi,
		helperArtifact.bytecode,
		signer,
	);
	const helper = await HelperFactory.deploy();
	await helper.waitForDeployment();
	const helperAddress = await helper.getAddress();

	console.log(`[INFO] Helper deployed at: ${helperAddress}`);

	// Deploy Verifier
	const VerifierFactory = new ethers.ContractFactory(
		verifierArtifact.abi,
		verifierArtifact.bytecode,
		signer,
	);
	const verifier = await VerifierFactory.deploy(helperAddress);
	await verifier.waitForDeployment();
	const verifierAddress = await verifier.getAddress();

	console.log(`[INFO] Verifier deployed at: ${verifierAddress}`);

	// Deploy ZKVoting
	const ZKVotingFactory = new ethers.ContractFactory(
		zkVotingArtifact.abi,
		zkVotingArtifact.bytecode,
		signer,
	);
	const zkVoting = await ZKVotingFactory.deploy();
	await zkVoting.waitForDeployment();
	const zkVotingAddress = await zkVoting.getAddress();

	console.log(`[INFO] ZKVoting deployed at: ${zkVotingAddress}`);
	console.log('');

	// Benchmark 1: Create Election
	console.log('-'.repeat(70));
	console.log('BENCHMARK 1: CREATE ELECTION TRANSACTION');
	console.log('-'.repeat(70));
	console.log('');

	const electionId = 12345n;
	const tx1 = await zkVoting.createElection(electionId, verifierAddress, true);
	const receipt1 = await tx1.wait();

	const calldataCreateElection = tx1.data;
	const calldataSizeBytes = (calldataCreateElection.length - 2) / 2;
	const gasUsed = receipt1.gasUsed;

	console.log(`Transaction Hash:                ${receipt1.hash}`);
	console.log(`Block Number:                    ${receipt1.blockNumber}`);
	console.log(`Gas Used:                        ${gasUsed.toString()}`);
	console.log(`Calldata Size:                   ${calldataSizeBytes} bytes`);
	console.log(`Calldata (hex):                  ${calldataCreateElection.substring(0, 66)}...`);
	console.log('');

	// Benchmark 2: Submit Vote
	console.log('-'.repeat(70));
	console.log('BENCHMARK 2: SUBMIT VOTE TRANSACTION');
	console.log('-'.repeat(70));
	console.log('');

	console.log('[INFO] Generating zkSNARK proof for vote...');

	const { proof, publicSignals } = await generateProof(
		eddsa,
		babyjub,
		issuerPrivKey,
		issuerPubKey,
		electionId,
	);

	const solidityProof = formatProofForSolidity(proof);
	const pubSignalsArray = publicSignals.map((s) => BigInt(s));

	const publicKeyPacked = babyjub.packPoint(issuerPubKey);
	const encryptedVote = await encryptVote(babyjub, 0, publicKeyPacked);

	console.log('[INFO] Submitting vote transaction...');

	const tx2 = await zkVoting.submitVote(
		solidityProof.pA,
		solidityProof.pB,
		solidityProof.pC,
		pubSignalsArray,
		encryptedVote,
	);
	const receipt2 = await tx2.wait();

	const calldataSubmitVote = tx2.data;
	const calldataSubmitVoteSize = (calldataSubmitVote.length - 2) / 2;
	const gasUsedSubmitVote = receipt2.gasUsed;

	console.log('');
	console.log(`Transaction Hash:                ${receipt2.hash}`);
	console.log(`Block Number:                    ${receipt2.blockNumber}`);
	console.log(`Gas Used:                        ${gasUsedSubmitVote.toString()}`);
	console.log(`Calldata Size:                   ${calldataSubmitVoteSize} bytes`);
	console.log(`Calldata (hex):                  ${calldataSubmitVote.substring(0, 66)}...`);
	console.log('');

	// Calculate calldata breakdown
	const methodSigSize = 4;
	const proofDataSize = 2 * 32 + 4 * 32 + 2 * 32; // pA (2*32) + pB (4*32) + pC (2*32)
	const publicSignalsSize = 259 * 32; // 259 public signals
	const encryptedVoteSize = (encryptedVote.length - 2) / 2;

	console.log('Calldata Breakdown (Submit Vote):');
	console.log(`   Method Signature:             ${methodSigSize} bytes`);
	console.log(`   Proof Data (pA, pB, pC):      ${proofDataSize} bytes`);
	console.log(`   Public Signals (259 values):  ${publicSignalsSize} bytes`);
	console.log(`   Encrypted Vote:               ${encryptedVoteSize} bytes`);
	console.log(
		`   ABI Encoding Overhead:        ~${calldataSubmitVoteSize - methodSigSize - proofDataSize - publicSignalsSize - encryptedVoteSize} bytes`,
	);
	console.log('');

	// Summary
	console.log('='.repeat(70));
	console.log('                           SUMMARY');
	console.log('='.repeat(70));
	console.log('');
	console.log('Transaction Type              Calldata Size       Gas Used');
	console.log('-'.repeat(70));
	console.log(
		`Create Election               ${calldataSizeBytes.toString().padEnd(20)}${gasUsed.toString()}`,
	);
	console.log(
		`Submit Vote                   ${calldataSubmitVoteSize.toString().padEnd(20)}${gasUsedSubmitVote.toString()}`,
	);
	console.log('');

	// Calculate costs at different gas prices
	const gasPrices = [1, 5, 10, 20, 50];
	console.log('Estimated Transaction Costs (in USD):');
	console.log('');
	console.log('Gas Price (Gwei)   Create Election    Submit Vote       ETH Price: $3000');
	console.log('-'.repeat(70));

	gasPrices.forEach((gwei) => {
		const createCost = (Number(gasUsed) * gwei * 3000) / 1e9;
		const submitCost = (Number(gasUsedSubmitVote) * gwei * 3000) / 1e9;
		console.log(
			`${gwei.toString().padEnd(19)}$${createCost.toFixed(4).padEnd(19)}$${submitCost.toFixed(4)}`,
		);
	});

	console.log('');
	console.log('='.repeat(70));
	console.log('BENCHMARK COMPLETED SUCCESSFULLY');
	console.log('='.repeat(70));

	const results = {
		timestamp: new Date().toISOString(),
		createElection: {
			calldataSize: calldataSizeBytes,
			gasUsed: gasUsed.toString(),
			calldata: calldataCreateElection,
		},
		submitVote: {
			calldataSize: calldataSubmitVoteSize,
			gasUsed: gasUsedSubmitVote.toString(),
			calldata: calldataSubmitVote.substring(0, 200) + '...',
			breakdown: {
				methodSignature: methodSigSize,
				proofData: proofDataSize,
				publicSignals: publicSignalsSize,
				encryptedVote: encryptedVoteSize,
			},
		},
	};

	fs.writeFileSync('./benchmark_calldata_results.json', JSON.stringify(results, null, 2));
	console.log('\n[INFO] Detailed results saved to: benchmark_calldata_results.json\n');

	process.exit(0);
}

benchmark().catch((error) => {
	console.error('\n[ERROR] Benchmark failed:', error);
	process.exit(1);
});
