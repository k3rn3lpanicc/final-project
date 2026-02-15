import { buildBabyjub, buildEddsa } from 'circomlibjs';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import os from 'os';

const ADMIN_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const NUM_VOTES = 2000;
const NUM_OPTIONS = 4;
const BATCH_SIZE = 100;
const NUM_WORKERS = Math.min(os.cpus().length, 8);

function bigIntToBuffer(bigInt) {
	const hex = bigInt.toString(16).padStart(64, '0');
	return Buffer.from(hex, 'hex');
}

function bufferToBigInt(buffer) {
	return BigInt('0x' + buffer.toString('hex'));
}

async function encryptBatch(startIndex, count, adminPublicKey, numOptions) {
	const babyJub = await buildBabyjub();
	const publicKeyBigInt = BigInt(adminPublicKey);
	const publicKeyBuffer = bigIntToBuffer(publicKeyBigInt);
	const publicKeyPacked = bufferToBigInt(publicKeyBuffer);
	const publicKeyPoint = babyJub.unpackPoint(babyJub.F.e(publicKeyPacked));

	const encryptedVotes = [];
	for (let i = 0; i < count; i++) {
		const optionIndex = Math.floor(Math.random() * numOptions);
		const nonce = Math.floor(Math.random() * 1000000);
		const message = `${optionIndex}|${nonce}`;
		const messageBuffer = Buffer.from(message, 'utf8');

		const randomBytes = Buffer.from(
			Array.from({ length: 31 }, () => Math.floor(Math.random() * 256)),
		);
		const r = bufferToBigInt(randomBytes) % babyJub.subOrder;

		const ephemeralPublicKey = babyJub.mulPointEscalar(babyJub.Base8, r);
		const sharedPoint = babyJub.mulPointEscalar(publicKeyPoint, r);
		const sharedSecret = bigIntToBuffer(babyJub.F.toObject(sharedPoint[0]));

		const ciphertext = Buffer.alloc(messageBuffer.length);
		for (let j = 0; j < messageBuffer.length; j++) {
			ciphertext[j] = messageBuffer[j] ^ sharedSecret[j % sharedSecret.length];
		}

		const ephemeralPublicKeyPacked = babyJub.packPoint(ephemeralPublicKey);
		const ephemeralPublicKeyBigInt = babyJub.F.toObject(babyJub.F.e(ephemeralPublicKeyPacked));

		encryptedVotes.push({
			ciphertext: '0x' + ciphertext.toString('hex'),
			ephemeralPublicKey: '0x' + ephemeralPublicKeyBigInt.toString(16).padStart(64, '0'),
		});
	}

	return encryptedVotes;
}

async function decryptBatch(votes, adminPrivateKey, numOptions) {
	const babyJub = await buildBabyjub();
	const adminPrivateKeyBuffer = Buffer.from(adminPrivateKey.slice(2), 'hex');
	const adminPrivateKeyBigInt = bufferToBigInt(adminPrivateKeyBuffer);

	const voteCounts = Array(numOptions).fill(0);
	let validVotes = 0;
	let invalidVotes = 0;

	for (const vote of votes) {
		try {
			const { ciphertext, ephemeralPublicKey } = vote;

			const ephemeralPublicKeyBigInt = BigInt(ephemeralPublicKey);
			const ephemeralPublicKeyBuffer = bigIntToBuffer(ephemeralPublicKeyBigInt);
			const ephemeralPublicKeyPacked = bufferToBigInt(ephemeralPublicKeyBuffer);
			const ephemeralPublicKeyPoint = babyJub.unpackPoint(
				babyJub.F.e(ephemeralPublicKeyPacked),
			);

			const sharedPoint = babyJub.mulPointEscalar(
				ephemeralPublicKeyPoint,
				adminPrivateKeyBigInt,
			);
			const sharedSecret = bigIntToBuffer(babyJub.F.toObject(sharedPoint[0]));

			const ciphertextBuffer = Buffer.from(ciphertext.slice(2), 'hex');
			const plaintextBuffer = Buffer.alloc(ciphertextBuffer.length);
			for (let j = 0; j < ciphertextBuffer.length; j++) {
				plaintextBuffer[j] = ciphertextBuffer[j] ^ sharedSecret[j % sharedSecret.length];
			}

			const message = plaintextBuffer.toString('utf8');
			const parts = message.split('|');

			if (parts.length === 2) {
				const optionIndex = parseInt(parts[0], 10);
				const nonce = parseInt(parts[1], 10);

				if (
					!isNaN(optionIndex) &&
					!isNaN(nonce) &&
					optionIndex >= 0 &&
					optionIndex < numOptions
				) {
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
	const eddsa = await buildEddsa();
	console.log('Done.');
	console.log();

	const adminPrivateKeyBuffer = Buffer.from(ADMIN_PRIVATE_KEY.slice(2), 'hex');
	const adminPublicKey = eddsa.prv2pub(adminPrivateKeyBuffer);
	const publicKeyPoint = babyJub.unpackPoint(adminPublicKey);
	const adminPublicKeyBigInt = babyJub.F.toObject(babyJub.F.e(babyJub.packPoint(publicKeyPoint)));
	const adminPublicKeyHex = '0x' + adminPublicKeyBigInt.toString(16).padStart(64, '0');

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
			promises.push(encryptBatch(startIndex, count, adminPublicKeyHex, NUM_OPTIONS));
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
