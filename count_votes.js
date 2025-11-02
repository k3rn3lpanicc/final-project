// Vote counting script for election administrators
// This script reads VoteSubmitted events from the Election contract,
// decrypts votes using the election private key, and counts them
// Optimized for handling millions of votes with parallel processing

import { ethers } from 'ethers';
import { buildBabyjub } from 'circomlibjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PARALLEL_WORKERS = Math.max(1, os.cpus().length - 1); // Use all CPU cores except one
const BATCH_SIZE = 1000; // Process votes in batches
const CHUNK_SIZE = 2000; // Maximum blocks per RPC request

// Import the election private key from decrypt_votes.js
const ELECTION_PRIVATE_KEY = BigInt(
	'250082668618633646334213584719494925374420844776732603861415520274085646643'
);

// Load Election contract ABI
const electionABI = JSON.parse(
	fs.readFileSync(path.join(__dirname, 'contracts', 'ElectionABI.json'), 'utf8')
);

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
 * Decrypts a vote encrypted with ECDH + AES-GCM
 */
async function decryptVote(encryptedData, privateKey) {
	const bjj = await buildBabyjub();

	// Remove 0x prefix if present
	const hexData = encryptedData.startsWith('0x') ? encryptedData.slice(2) : encryptedData;

	// Parse components: R_x (64) + R_y (64) + IV (24) + ciphertext+tag
	if (hexData.length < 152) {
		throw new Error(`Encrypted data too short: ${hexData.length} chars`);
	}

	const rx = BigInt('0x' + hexData.slice(0, 64));
	const ry = BigInt('0x' + hexData.slice(64, 128));
	const ivHex = hexData.slice(128, 152);
	const ciphertextHex = hexData.slice(152);

	// Convert R to curve point
	const R = [bjj.F.e(rx), bjj.F.e(ry)];

	// Compute shared secret: S = privKey * R
	const S = bjj.mulPointEscalar(R, privateKey);
	const sharedSecretX = BigInt(bjj.F.toObject(S[0]));

	// Derive AES key from shared secret
	const aesKey = deriveAESKey(sharedSecretX);

	// Convert IV and ciphertext from hex to Buffer
	const iv = Buffer.from(ivHex, 'hex');
	const ciphertextWithTag = Buffer.from(ciphertextHex, 'hex');

	// Split ciphertext and auth tag (last 16 bytes)
	const authTag = ciphertextWithTag.slice(-16);
	const ciphertext = ciphertextWithTag.slice(0, -16);

	// Decrypt using AES-GCM
	const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
	decipher.setAuthTag(authTag);

	let plaintext = decipher.update(ciphertext, null, 'utf8');
	plaintext += decipher.final('utf8');

	// Parse plaintext: "optionIndex|nonce"
	const parts = plaintext.split('|');
	if (parts.length !== 2) {
		throw new Error(`Invalid plaintext format: "${plaintext}"`);
	}

	const optionIndex = parseInt(parts[0], 10);
	const nonce = parts[1];

	if (isNaN(optionIndex)) {
		throw new Error(`Invalid optionIndex: "${parts[0]}"`);
	}

	return {
		optionIndex,
		nonce,
		plaintext,
	};
}

/**
 * Process a batch of votes in parallel using multiple workers
 */
async function processBatchParallel(batch, offset) {
	const bjj = await buildBabyjub();
	const chunkSize = Math.ceil(batch.length / PARALLEL_WORKERS);
	const promises = [];

	for (let i = 0; i < PARALLEL_WORKERS && i * chunkSize < batch.length; i++) {
		const chunkStart = i * chunkSize;
		const chunkEnd = Math.min(chunkStart + chunkSize, batch.length);
		const chunk = batch.slice(chunkStart, chunkEnd);

		// Process chunk synchronously (parallel at batch level)
		promises.push(processChunk(chunk, offset + chunkStart, bjj));
	}

	const results = await Promise.all(promises);
	return results.flat();
}

/**
 * Process a chunk of votes
 */
async function processChunk(events, offset, bjj) {
	const results = [];

	for (let i = 0; i < events.length; i++) {
		const event = events[i];
		const voteNumber = offset + i + 1;

		try {
			const decrypted = await decryptVote(event.args.encryptedVote, ELECTION_PRIVATE_KEY);

			results.push({
				success: true,
				voteNumber,
				blockNumber: event.blockNumber,
				transactionHash: event.transactionHash,
				sender: event.args.sender,
				nullifierHash: event.args.nullifierHash.toString(),
				optionIndex: decrypted.optionIndex,
				nonce: decrypted.nonce,
			});
		} catch (error) {
			results.push({
				success: false,
				voteNumber,
				blockNumber: event.blockNumber,
				transactionHash: event.transactionHash,
				sender: event.args.sender,
				nullifierHash: event.args.nullifierHash.toString(),
				error: error.message,
			});
		}
	}

	return results;
}

/**
 * Counts votes from Election contract events
 */
async function countVotes(contractAddress, electionId, rpcUrl) {
	console.log('Vote Counting Script');
	console.log('====================\n');
	console.log(`Contract Address: ${contractAddress}`);
	console.log(`Election ID: ${electionId}`);
	console.log(`RPC URL: ${rpcUrl}\n`);

	// Connect to blockchain
	const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
	const contract = new ethers.Contract(contractAddress, electionABI, provider);

	console.log('Fetching VoteSubmitted events...\n');

	// Get contract deployment block to optimize search
	const currentBlock = await provider.getBlockNumber();
	console.log(`Current block: ${currentBlock}`);

	// Get all VoteSubmitted events for this election in chunks
	const filter = contract.filters.VoteSubmitted(electionId);
	let allEvents = [];

	let fromBlock = 35709656;
	let toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
	
	const totalBlocks = currentBlock - fromBlock + 1;
	let fetchedBlocks = 0;
	const fetchStartTime = Date.now();

	while (fromBlock <= currentBlock) {
		const progress = ((fetchedBlocks / totalBlocks) * 100).toFixed(1);
		const elapsed = ((Date.now() - fetchStartTime) / 1000).toFixed(1);
		
		process.stdout.write(
			`\rFetching blocks ${fromBlock} to ${toBlock} (${progress}% | ${elapsed}s)...`
		);

		try {
			const events = await contract.queryFilter(filter, fromBlock, toBlock);
			allEvents = allEvents.concat(events);
		} catch (error) {
			console.log(
				`\nWarning: Error fetching blocks ${fromBlock}-${toBlock}: ${error.message}`
			);
		}

		fetchedBlocks += (toBlock - fromBlock + 1);
		fromBlock = toBlock + 1;
		toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
	}

	console.log('\n');
	const events = allEvents;

	console.log(`Found ${events.length} vote(s) for election ${electionId}\n`);

	if (events.length === 0) {
		console.log('No votes found for this election.');
		return;
	}

	// Count votes by option
	const voteCounts = {};
	const validVotes = [];
	const invalidVotes = [];

	console.log('Decrypting and counting votes...\n');
	console.log(`Processing ${events.length} votes using ${PARALLEL_WORKERS} worker(s)...\n`);
	console.log('='.repeat(70));

	const startTime = Date.now();
	let processedCount = 0;

	// Process votes in batches using parallel processing
	for (let batchStart = 0; batchStart < events.length; batchStart += BATCH_SIZE) {
		const batchEnd = Math.min(batchStart + BATCH_SIZE, events.length);
		const batch = events.slice(batchStart, batchEnd);

		// Process batch with parallel workers
		const results = await processBatchParallel(batch, batchStart);

		// Aggregate results
		for (const result of results) {
			if (result.success) {
				if (!voteCounts[result.optionIndex]) {
					voteCounts[result.optionIndex] = 0;
				}
				voteCounts[result.optionIndex]++;
				validVotes.push(result);
			} else {
				invalidVotes.push(result);
			}
		}

		processedCount += batch.length;
		const progress = ((processedCount / events.length) * 100).toFixed(1);
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
		const rate = (processedCount / (Date.now() - startTime) * 1000).toFixed(1);
		const eta = ((events.length - processedCount) / rate).toFixed(0);

		process.stdout.write(
			`\rProgress: ${processedCount}/${events.length} (${progress}%) | ` +
			`${rate} votes/sec | Elapsed: ${elapsed}s | ETA: ${eta}s`
		);
	}

	console.log('\n');

	// Display results
	const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
	const avgRate = (events.length / totalTime).toFixed(1);
	
	console.log('\n' + '='.repeat(70));
	console.log('\nVOTE COUNTING RESULTS');
	console.log('='.repeat(70));
	console.log(`\nTotal votes received: ${events.length}`);
	console.log(`Valid votes: ${validVotes.length}`);
	console.log(`Invalid/Malformed votes: ${invalidVotes.length}`);
	console.log(`\nProcessing time: ${totalTime}s`);
	console.log(`Average rate: ${avgRate} votes/sec`);
	console.log(`Workers used: ${PARALLEL_WORKERS}\n`);

	if (Object.keys(voteCounts).length > 0) {
		console.log('Vote Distribution:');
		console.log('-'.repeat(40));

		// Sort by option index
		const sortedOptions = Object.keys(voteCounts)
			.map(Number)
			.sort((a, b) => a - b);

		for (const optionIndex of sortedOptions) {
			const count = voteCounts[optionIndex];
			const percentage = ((count / validVotes.length) * 100).toFixed(2);
			const bar = '█'.repeat(Math.floor((count / validVotes.length) * 40));

			console.log(`  Option ${optionIndex}: ${count} vote(s) (${percentage}%)`);
			console.log(`    ${bar}`);
		}
	}

	if (invalidVotes.length > 0) {
		console.log('\n' + '-'.repeat(70));
		console.log('\nInvalid/Malformed Votes:');
		console.log('-'.repeat(70));

		for (const vote of invalidVotes) {
			console.log(`\nVote #${vote.voteNumber}:`);
			console.log(`  TX: ${vote.transactionHash}`);
			console.log(`  Error: ${vote.error}`);
		}
	}

	// Save detailed results to JSON file
	const results = {
		contractAddress,
		electionId,
		timestamp: new Date().toISOString(),
		totalVotes: events.length,
		validVotes: validVotes.length,
		invalidVotes: invalidVotes.length,
		voteCounts,
		detailedVotes: validVotes,
		invalidVoteDetails: invalidVotes,
	};

	const resultsFilename = `vote_results_${electionId}_${Date.now()}.json`;
	fs.writeFileSync(resultsFilename, JSON.stringify(results, null, 2));

	console.log('\n' + '='.repeat(70));
	console.log(`\n✓ Detailed results saved to: ${resultsFilename}\n`);
}

// Main execution
async function main() {
	const args = process.argv.slice(2);

	if (args.length < 2) {
		console.log('Usage: node count_votes.js <contractAddress> <electionId> [rpcUrl]');
		console.log('\nExample:');
		console.log(
			'  node count_votes.js 0x1234... 1 https://data-seed-prebsc-1-s1.binance.org:8545/'
		);
		console.log('  node count_votes.js 0x1234... 1 http://127.0.0.1:8545/');
		console.log('\nDefault RPC: http://127.0.0.1:8545/ (local hardhat node)');
		process.exit(1);
	}

	const contractAddress = args[0];
	const electionId = args[1];
	const rpcUrl = args[2] || 'http://127.0.0.1:8545/';

	try {
		await countVotes(contractAddress, electionId, rpcUrl);
	} catch (error) {
		console.error('\n❌ Error:', error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

main().catch(console.error);
