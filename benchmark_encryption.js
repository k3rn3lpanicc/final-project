import { buildBabyjub, buildEddsa } from 'circomlibjs';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import os from 'os';

const ADMIN_PRIVATE_KEY = BigInt(
	'250082668618633646334213584719494925374420844776732603861415520274085646643',
);
const NUM_VOTES = 2000;
const NUM_OPTIONS = 4;
const BATCH_SIZE = 100;
const NUM_WORKERS = Math.min(os.cpus().length, 12);

function deriveAESKey(sharedSecretX) {
	const sharedBytes = Buffer.alloc(32);
	const hexStr = sharedSecretX.toString(16).padStart(64, '0');
	for (let i = 0; i < 32; i++) {
		sharedBytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
	}
	return crypto.createHash('sha256').update(sharedBytes).digest();
}

async function encryptBatch(startIndex, count, adminPublicKey, numOptions) {
	const babyJub = await buildBabyjub();
	const publicKeyPoint = [babyJub.F.e(adminPublicKey.x), babyJub.F.e(adminPublicKey.y)];

	const encryptedVotes = [];
	for (let i = 0; i < count; i++) {
		const optionIndex = Math.floor(Math.random() * numOptions);
		const nonce = crypto.randomBytes(16).toString('hex');
		const message = `${optionIndex}|${nonce}`;

		// Generate random scalar r
		const randomBytes = crypto.randomBytes(32);
		const r = BigInt('0x' + randomBytes.toString('hex')) % babyJub.subOrder;

		// Compute ephemeral public key R = r * Base8
		const R = babyJub.mulPointEscalar(babyJub.Base8, r);

		// Compute shared secret S = r * PublicKey
		const S = babyJub.mulPointEscalar(publicKeyPoint, r);
		const sharedSecretX = BigInt(babyJub.F.toObject(S[0]));

		// Derive AES key
		const aesKey = deriveAESKey(sharedSecretX);

		// Generate random IV
		const iv = crypto.randomBytes(12);

		// Encrypt using AES-GCM
		const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
		let ciphertext = cipher.update(message, 'utf8');
		ciphertext = Buffer.concat([ciphertext, cipher.final()]);
		const authTag = cipher.getAuthTag();

		// Combine: R_x | R_y | IV | ciphertext | authTag
		const rx = babyJub.F.toObject(R[0]);
		const ry = babyJub.F.toObject(R[1]);
		const rxHex = rx.toString(16).padStart(64, '0');
		const ryHex = ry.toString(16).padStart(64, '0');
		const ivHex = iv.toString('hex');
		const ciphertextHex = ciphertext.toString('hex');
		const authTagHex = authTag.toString('hex');

		const encryptedVote = '0x' + rxHex + ryHex + ivHex + ciphertextHex + authTagHex;

		encryptedVotes.push(encryptedVote);
	}

	return encryptedVotes;
}

async function decryptBatch(votes, adminPrivateKey, numOptions) {
	const babyJub = await buildBabyjub();

	const voteCounts = Array(numOptions).fill(0);
	let validVotes = 0;
	let invalidVotes = 0;

	for (const encryptedVote of votes) {
		try {
			const hexData = encryptedVote.startsWith('0x') ? encryptedVote.slice(2) : encryptedVote;

			if (hexData.length < 152) {
				invalidVotes++;
				continue;
			}

			// Parse components
			const rx = BigInt('0x' + hexData.slice(0, 64));
			const ry = BigInt('0x' + hexData.slice(64, 128));
			const ivHex = hexData.slice(128, 152);
			const ciphertextHex = hexData.slice(152);

			// Convert R to curve point
			const R = [babyJub.F.e(rx), babyJub.F.e(ry)];

			// Compute shared secret: S = privKey * R
			const S = babyJub.mulPointEscalar(R, adminPrivateKey);
			const sharedSecretX = BigInt(babyJub.F.toObject(S[0]));

			// Derive AES key
			const aesKey = deriveAESKey(sharedSecretX);

			// Convert IV and ciphertext from hex to Buffer
			const iv = Buffer.from(ivHex, 'hex');
			const ciphertextWithTag = Buffer.from(ciphertextHex, 'hex');

			// Split ciphertext and auth tag
			const authTag = ciphertextWithTag.slice(-16);
			const ciphertext = ciphertextWithTag.slice(0, -16);

			// Decrypt using AES-GCM
			const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
			decipher.setAuthTag(authTag);

			let plaintext = decipher.update(ciphertext, null, 'utf8');
			plaintext += decipher.final('utf8');

			// Parse plaintext
			const parts = plaintext.split('|');
			if (parts.length === 2) {
				const optionIndex = parseInt(parts[0], 10);

				if (!isNaN(optionIndex) && optionIndex >= 0 && optionIndex < numOptions) {
					voteCounts[optionIndex]++;
					validVotes++;
				} else {
					invalidVotes++;
				}
			} else {
				invalidVotes++;
			}
		} catch (error) {
			invalidVotes++;
		}
	}

	return { voteCounts, validVotes, invalidVotes };
}

async function main() {
	console.log('========================================');
	console.log('Encryption/Decryption Performance Benchmark');
	console.log('========================================');
	console.log();
	console.log('Configuration:');
	console.log(`  Number of votes: ${NUM_VOTES.toLocaleString()}`);
	console.log(`  Number of options: ${NUM_OPTIONS}`);
	console.log(`  Batch size: ${BATCH_SIZE.toLocaleString()}`);
	console.log(`  Parallel batches: ${NUM_WORKERS}`);
	console.log();

	console.log('Initializing cryptographic libraries...');
	const babyJub = await buildBabyjub();
	console.log('Done.');
	console.log();

	// Calculate public key from private key
	const adminPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, ADMIN_PRIVATE_KEY);
	const adminPublicKey = {
		x: BigInt(babyJub.F.toObject(adminPublicKeyPoint[0])),
		y: BigInt(babyJub.F.toObject(adminPublicKeyPoint[1])),
	};

	console.log('Generating and encrypting votes (parallel batches)...');
	const startGeneration = performance.now();

	const encryptedVotes = [];
	const numBatches = Math.ceil(NUM_VOTES / BATCH_SIZE);

	for (let batch = 0; batch < numBatches; batch += NUM_WORKERS) {
		const promises = [];
		const actualBatchCount = Math.min(NUM_WORKERS, numBatches - batch);

		for (let i = 0; i < actualBatchCount; i++) {
			const batchIndex = batch + i;
			const startIndex = batchIndex * BATCH_SIZE;
			const count = Math.min(BATCH_SIZE, NUM_VOTES - startIndex);
			promises.push(encryptBatch(startIndex, count, adminPublicKey, NUM_OPTIONS));
		}

		const results = await Promise.all(promises);
		for (const result of results) {
			encryptedVotes.push(...result);
		}

		console.log(`  Generated ${encryptedVotes.length.toLocaleString()} votes...`);
	}

	const endGeneration = performance.now();
	const generationTime = (endGeneration - startGeneration) / 1000;
	console.log('Done.');
	console.log();

	console.log('Decrypting and counting votes (parallel batches)...');
	const startCounting = performance.now();

	const totalVoteCounts = Array(NUM_OPTIONS).fill(0);
	let totalValidVotes = 0;
	let totalInvalidVotes = 0;

	const decryptionBatches = [];
	for (let i = 0; i < encryptedVotes.length; i += BATCH_SIZE) {
		decryptionBatches.push(encryptedVotes.slice(i, i + BATCH_SIZE));
	}

	for (let batch = 0; batch < decryptionBatches.length; batch += NUM_WORKERS) {
		const promises = [];
		const actualBatchCount = Math.min(NUM_WORKERS, decryptionBatches.length - batch);

		for (let i = 0; i < actualBatchCount; i++) {
			const batchIndex = batch + i;
			promises.push(
				decryptBatch(decryptionBatches[batchIndex], ADMIN_PRIVATE_KEY, NUM_OPTIONS),
			);
		}

		const results = await Promise.all(promises);
		for (const result of results) {
			for (let i = 0; i < NUM_OPTIONS; i++) {
				totalVoteCounts[i] += result.voteCounts[i];
			}
			totalValidVotes += result.validVotes;
			totalInvalidVotes += result.invalidVotes;
		}

		const processedVotes = (batch + actualBatchCount) * BATCH_SIZE;
		console.log(
			`  Decrypted ${Math.min(processedVotes, encryptedVotes.length).toLocaleString()} votes...`,
		);
	}

	const endCounting = performance.now();
	const countingTime = (endCounting - startCounting) / 1000;
	console.log('Done.');
	console.log();

	console.log('========================================');
	console.log('Results');
	console.log('========================================');
	console.log();
	console.log('Generation Phase:');
	console.log(`  Total votes generated: ${NUM_VOTES.toLocaleString()}`);
	console.log(`  Time taken: ${generationTime.toFixed(2)} seconds`);
	console.log(`  Generation rate: ${(NUM_VOTES / generationTime).toFixed(2)} votes/second`);
	console.log();
	console.log('Counting Phase:');
	console.log(`  Total votes decrypted: ${encryptedVotes.length.toLocaleString()}`);
	console.log(`  Valid votes: ${totalValidVotes.toLocaleString()}`);
	console.log(`  Invalid votes: ${totalInvalidVotes.toLocaleString()}`);
	console.log(`  Time taken: ${countingTime.toFixed(2)} seconds`);
	console.log(
		`  Counting rate: ${(encryptedVotes.length / countingTime).toFixed(2)} votes/second`,
	);
	console.log();
	console.log('Vote Distribution:');
	for (let i = 0; i < NUM_OPTIONS; i++) {
		const percentage =
			totalValidVotes > 0
				? ((totalVoteCounts[i] / totalValidVotes) * 100).toFixed(2)
				: '0.00';
		console.log(`  Option ${i}: ${totalVoteCounts[i].toLocaleString()} votes (${percentage}%)`);
	}
	console.log();
	console.log('========================================');
	console.log('Summary');
	console.log('========================================');
	console.log();
	console.log(
		`Vote generation performance: ${(NUM_VOTES / generationTime).toFixed(2)} votes/second`,
	);
	console.log(
		`Vote counting performance: ${(encryptedVotes.length / countingTime).toFixed(2)} votes/second`,
	);
	console.log(`Total benchmark time: ${(generationTime + countingTime).toFixed(2)} seconds`);
	console.log();
	console.log('Benchmark completed successfully.');
}

main().catch(console.error);
