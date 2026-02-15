const crypto = require('crypto');
const circomlibjs = require('circomlibjs');
const { poseidon1, poseidon3 } = require('poseidon-lite');
const snarkjs = require('snarkjs');
const fs = require('fs');

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

async function generateProofOnce(eddsa, babyjub, issuerPrivKey, issuerPubKey) {
	// 1. Generate random private inputs
	const ID = generateRandomBigInt();
	const X = generateRandomBigInt();
	const Xp = generateRandomBigInt();
	const electionId = generateRandomBigInt();

	// 2. Compute hashes
	const hashXp = poseidon1([Xp]);
	const msgField = poseidon3([ID, X, hashXp]);

	// 3. Sign the message
	const msgBytes = toBytesLE32(msgField);
	const signature = eddsa.signPedersen(issuerPrivKey, msgBytes);

	const A_bits = bytesToBitsLE(babyjub.packPoint(issuerPubKey));
	const R8_bits = bytesToBitsLE(babyjub.packPoint(signature.R8));
	const S_bits = bytesToBitsLE(toBytesLE32(BigInt(signature.S)));

	// 4. Compute nullifier hash
	const nh = poseidon3([X, Xp, electionId]);

	// 5. Create input
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

	// 6. Generate proof
	const { proof, publicSignals } = await snarkjs.groth16.fullProve(
		input,
		'./build/VoteScheme_js/VoteScheme.wasm',
		'./VoteScheme_final.zkey',
	);

	return { proof, publicSignals };
}

async function benchmark() {
	console.log('='.repeat(60));
	console.log('         zkSNARK PROOF GENERATION BENCHMARK');
	console.log('='.repeat(60));
	console.log('');

	// Initialize circomlibjs components
	console.log('[INFO] Initializing cryptographic components...');
	const eddsa = await circomlibjs.buildEddsa();
	const babyjub = await circomlibjs.buildBabyjub();

	// Generate issuer's key pair (constant)
	const issuerPrivKey = Buffer.from(
		'0001020304050607080900010203040506070809000102030405060708090001',
		'hex',
	);
	const issuerPubKey = eddsa.prv2pub(issuerPrivKey);

	console.log('[INFO] Initialization complete\n');

	// Check if required files exist
	const wasmPath = './build/VoteScheme_js/VoteScheme.wasm';
	const zkeyPath = './VoteScheme_final.zkey';

	if (!fs.existsSync(wasmPath)) {
		console.error(`[ERROR] WASM file not found at ${wasmPath}`);
		console.error('        Please build the circuit first.');
		process.exit(1);
	}

	if (!fs.existsSync(zkeyPath)) {
		console.error(`[ERROR] zkey file not found at ${zkeyPath}`);
		console.error('        Please generate the zkey first.');
		process.exit(1);
	}

	console.log('[INFO] Starting benchmark...');
	console.log('       Target: 100 proof generations\n');

	const iterations = 100;
	const times = [];
	const startTime = Date.now();

	// Progress tracking
	const printProgress = (current, total) => {
		const percent = ((current / total) * 100).toFixed(1);
		const bar =
			'#'.repeat(Math.floor(current / 20)) + '-'.repeat(50 - Math.floor(current / 20));
		process.stdout.write(`\r       Progress: [${bar}] ${percent}% (${current}/${total})`);
	};

	// Generate proofs
	for (let i = 0; i < iterations; i++) {
		const iterationStart = Date.now();

		try {
			await generateProofOnce(eddsa, babyjub, issuerPrivKey, issuerPubKey);
			const iterationTime = Date.now() - iterationStart;
			times.push(iterationTime);
		} catch (error) {
			console.error(`\n[ERROR] Failure at iteration ${i + 1}:`, error.message);
			process.exit(1);
		}

		if ((i + 1) % 10 === 0 || i === iterations - 1) {
			printProgress(i + 1, iterations);
		}
	}

	const totalTime = Date.now() - startTime;

	console.log('\n\n' + '='.repeat(60));
	console.log('                    RESULTS');
	console.log('='.repeat(60));

	// Calculate statistics
	const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
	const minTime = Math.min(...times);
	const maxTime = Math.max(...times);
	const sortedTimes = [...times].sort((a, b) => a - b);
	const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];

	// Calculate standard deviation
	const variance =
		times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;
	const stdDev = Math.sqrt(variance);

	console.log('');
	console.log(`Total proofs generated:        ${iterations}`);
	console.log(`Total time:                    ${(totalTime / 1000).toFixed(3)} seconds`);
	console.log(`Average time per proof:        ${(avgTime / 1000).toFixed(3)} seconds`);
	console.log(`Median time:                   ${(medianTime / 1000).toFixed(3)} seconds`);
	console.log(`Fastest proof:                 ${(minTime / 1000).toFixed(3)} seconds`);
	console.log(`Slowest proof:                 ${(maxTime / 1000).toFixed(3)} seconds`);
	console.log(`Standard deviation:            ${(stdDev / 1000).toFixed(3)} seconds`);
	console.log('');
	console.log(
		`Throughput:                    ${((iterations / totalTime) * 1000).toFixed(2)} proofs/second`,
	);
	console.log('');

	// Calculate percentiles
	const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
	const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

	console.log('Percentiles:');
	console.log(`   95th percentile:            ${(p95 / 1000).toFixed(3)} seconds`);
	console.log(`   99th percentile:            ${(p99 / 1000).toFixed(3)} seconds`);
	console.log('');

	// Time distribution
	const ranges = [
		{ max: 100, label: '0.00-0.10s' },
		{ max: 200, label: '0.10-0.20s' },
		{ max: 300, label: '0.20-0.30s' },
		{ max: 400, label: '0.30-0.40s' },
		{ max: 500, label: '0.40-0.50s' },
		{ max: 1000, label: '0.50-1.00s' },
		{ max: Infinity, label: '>1.00s' },
	];

	console.log('Time Distribution:');
	let prevMax = 0;
	ranges.forEach((range) => {
		const count = times.filter((t) => t > prevMax && t <= range.max).length;
		const percent = ((count / iterations) * 100).toFixed(1);
		const barLength = Math.floor(count / 20);
		const bar = '#'.repeat(barLength);
		console.log(`   ${range.label.padEnd(15)} ${bar} ${count} (${percent}%)`);
		prevMax = range.max;
	});

	console.log('');
	console.log('='.repeat(60));
	console.log('BENCHMARK COMPLETED SUCCESSFULLY');
	console.log('='.repeat(60));

	// Save detailed results
	const results = {
		timestamp: new Date().toISOString(),
		iterations,
		totalTimeSeconds: totalTime / 1000,
		statistics: {
			averageSeconds: avgTime / 1000,
			medianSeconds: medianTime / 1000,
			minSeconds: minTime / 1000,
			maxSeconds: maxTime / 1000,
			stdDevSeconds: stdDev / 1000,
			throughputPerSecond: (iterations / totalTime) * 1000,
		},
		percentiles: {
			p95Seconds: p95 / 1000,
			p99Seconds: p99 / 1000,
		},
		allTimesMs: times,
	};

	fs.writeFileSync('./benchmark_results.json', JSON.stringify(results, null, 2));
	console.log('\n[INFO] Detailed results saved to: benchmark_results.json\n');
}

// Run benchmark
benchmark().catch((error) => {
	console.error('\n[ERROR] Benchmark failed:', error);
	process.exit(1);
});
