// Test script to verify contract deployment and function call
const { ethers } = require('ethers');

// Configuration
const VERIFIER_ADDRESS = '0x04172AC48eB0e8B6d634ABcB78129b43469F6Ab8';
const RPC_URL = 'http://127.0.0.1:8545/';

const VERIFIER_ABI = [
	{
		inputs: [
			{ internalType: 'uint256[2]', name: '_pA', type: 'uint256[2]' },
			{ internalType: 'uint256[2][2]', name: '_pB', type: 'uint256[2][2]' },
			{ internalType: 'uint256[2]', name: '_pC', type: 'uint256[2]' },
			{ internalType: 'uint256[259]', name: '_pubSignals', type: 'uint256[259]' },
		],
		name: 'verifyProof',
		outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
		stateMutability: 'view',
		type: 'function',
	},
];

async function testContract() {
	console.log('Testing contract deployment...\n');

	// Connect to provider (ethers v5 style)
	let provider;
	if (ethers.providers && ethers.providers.JsonRpcProvider) {
		provider = new ethers.providers.JsonRpcProvider(RPC_URL);
	} else {
		provider = new ethers.JsonRpcProvider(RPC_URL);
	}

	// Check if contract exists
	const code = await provider.getCode(VERIFIER_ADDRESS);
	console.log('Contract code length:', code.length);
	if (code === '0x') {
		console.error('❌ No contract found at address:', VERIFIER_ADDRESS);
		console.error('\nPlease deploy the contract first using:');
		console.error('npx hardhat run scripts/deploy.js --network localhost');
		return;
	}
	console.log('✅ Contract found at address:', VERIFIER_ADDRESS);

	// Create contract instance
	const verifier = new ethers.Contract(VERIFIER_ADDRESS, VERIFIER_ABI, provider);

	// Try to call with dummy data
	console.log('\nTesting verifyProof with dummy data...');
	try {
		// Create dummy proof data (all zeros)
		const dummyPA = ['0', '0'];
		const dummyPB = [
			['0', '0'],
			['0', '0'],
		];
		const dummyPC = ['0', '0'];
		const dummySignals = Array(259).fill('0');

		console.log('Calling verifyProof...');
		const result = await verifier.verifyProof(dummyPA, dummyPB, dummyPC, dummySignals);
		console.log('✅ Function call succeeded!');
		console.log('Result:', result);
	} catch (error) {
		console.error('❌ Function call failed:', error.message);
		if (error.data) {
			console.error('Error data:', error.data);
		}
	}

	// Check network
	const network = await provider.getNetwork();
	console.log('\nNetwork info:');
	console.log('Chain ID:', network.chainId.toString());
	console.log('Network name:', network.name);

	// Check accounts
	const accounts = await provider.listAccounts();
	console.log('\nAvailable accounts:', accounts.length);
}

testContract()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
