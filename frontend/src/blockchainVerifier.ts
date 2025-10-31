// On-chain verification using ethers.js
import { ethers } from 'ethers';
import type { Proof } from './proofGenerator';

// Binance Smart Chain Testnet configuration
const BSC_TESTNET_CONFIG = {
	chainId: 121212,
	name: 'Hardhat',
	rpcUrl: 'http://127.0.0.1:8545/',
	blockExplorer: 'https://testnet.bscscan.com',
};

// Placeholder contract address (user will update this)
const VERIFIER_CONTRACT_ADDRESS = '0x04172AC48eB0e8B6d634ABcB78129b43469F6Ab8'; // TODO: Update with actual deployed address

// Groth16Verifier contract ABI (only the verifyProof function)
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

// Format proof for Solidity contract
function formatProofForContract(proof: Proof, publicSignals: string[]) {
	// snarkjs proof format needs to be converted for Solidity
	// Remove the "1" coordinate (it's implicit in affine coordinates)
	const pA = [proof.pi_a[0], proof.pi_a[1]];

	// pB needs coordinate swap for Solidity
	const pB = [
		[proof.pi_b[0][1], proof.pi_b[0][0]],
		[proof.pi_b[1][1], proof.pi_b[1][0]],
	];

	const pC = [proof.pi_c[0], proof.pi_c[1]];

	console.log('Proof formatting:', {
		originalProof: {
			pi_a: proof.pi_a,
			pi_b: proof.pi_b,
			pi_c: proof.pi_c,
		},
		formatted: {
			pA,
			pB,
			pC,
			pubSignalsCount: publicSignals.length,
			firstSignal: publicSignals[0],
			lastSignal: publicSignals[publicSignals.length - 1],
		},
	});

	return {
		pA,
		pB,
		pC,
		pubSignals: publicSignals,
	};
}

// Check if MetaMask is installed
export function isMetaMaskInstalled(): boolean {
	return typeof (window as any).ethereum !== 'undefined';
}

// Connect to MetaMask
export async function connectWallet(): Promise<string> {
	if (!isMetaMaskInstalled()) {
		throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
	}

	const ethereum = (window as any).ethereum;

	try {
		// Request account access
		const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

		// Check if on BSC Testnet
		// const chainId = await ethereum.request({ method: 'eth_chainId' });

		// if (chainId !== '0x61') {
		// 	// 0x61 = 97 in hex
		// 	// Try to switch to BSC Testnet
		// 	try {
		// 		await ethereum.request({
		// 			method: 'wallet_switchEthereumChain',
		// 			params: [{ chainId: '0x61' }],
		// 		});
		// 	} catch (switchError: any) {
		// 		// Chain not added, try to add it
		// 		if (switchError.code === 4902) {
		// 			await ethereum.request({
		// 				method: 'wallet_addEthereumChain',
		// 				params: [
		// 					{
		// 						chainId: '0x61',
		// 						chainName: 'BSC Testnet',
		// 						nativeCurrency: {
		// 							name: 'BNB',
		// 							symbol: 'tBNB',
		// 							decimals: 18,
		// 						},
		// 						rpcUrls: [BSC_TESTNET_CONFIG.rpcUrl],
		// 						blockExplorerUrls: [BSC_TESTNET_CONFIG.blockExplorer],
		// 					},
		// 				],
		// 			});
		// 		} else {
		// 			throw switchError;
		// 		}
		// 	}
		// }

		return accounts[0];
	} catch (error) {
		console.error('Error connecting wallet:', error);
		throw error;
	}
}

// Verify proof on-chain using the deployed verifier contract
export async function verifyProofOnChain(
	proof: Proof,
	publicSignals: string[],
	onProgress?: (message: string) => void
): Promise<{ success: boolean; txHash?: string; error?: string }> {
	try {
		onProgress?.('Connecting to wallet...');

		if (!isMetaMaskInstalled()) {
			throw new Error('MetaMask not installed');
		}

		// Connect wallet
		const account = await connectWallet();
		onProgress?.(`Connected: ${account.slice(0, 6)}...${account.slice(-4)}`);

		// Create provider and signer
		const provider = new ethers.BrowserProvider((window as any).ethereum);
		const signer = await provider.getSigner();

		onProgress?.('Loading verifier contract...');

		// Check if contract exists at address
		const code = await provider.getCode(VERIFIER_CONTRACT_ADDRESS);
		if (code === '0x') {
			throw new Error(
				`No contract found at address ${VERIFIER_CONTRACT_ADDRESS}. Please ensure the contract is deployed.`
			);
		}
		onProgress?.('✅ Contract found at address');

		// Create contract instance
		const verifierContract = new ethers.Contract(
			VERIFIER_CONTRACT_ADDRESS,
			VERIFIER_ABI,
			signer
		);

		// Format proof for Solidity
		const formattedProof = formatProofForContract(proof, publicSignals);

		// Log formatted proof for debugging
		console.log('Formatted proof:', {
			pA: formattedProof.pA,
			pB: formattedProof.pB,
			pC: formattedProof.pC,
			pubSignalsCount: formattedProof.pubSignals.length,
		});

		onProgress?.('Calling verifyProof on local Hardhat node...');

		// Try to estimate gas first to check if it will revert
		try {
			await verifierContract.verifyProof.estimateGas(
				formattedProof.pA,
				formattedProof.pB,
				formattedProof.pC,
				formattedProof.pubSignals
			);
		} catch (gasError: any) {
			console.error('Gas estimation failed:', gasError);
			throw new Error(`Contract will revert: ${gasError.message || 'Invalid proof data'}`);
		}

		// Call verifyProof (this is a view function, no gas needed)
		const isValid = await verifierContract.verifyProof(
			formattedProof.pA,
			formattedProof.pB,
			formattedProof.pC,
			formattedProof.pubSignals
		);

		onProgress?.(
			isValid ? '✅ On-chain verification successful!' : '❌ On-chain verification failed!'
		);

		return {
			success: isValid,
		};
	} catch (error: any) {
		console.error('On-chain verification error:', error);

		let errorMessage = 'Unknown error';
		if (error.message) {
			errorMessage = error.message;
		} else if (error.reason) {
			errorMessage = error.reason;
		}

		return {
			success: false,
			error: errorMessage,
		};
	}
}

// Get contract address (for display purposes)
export function getVerifierContractAddress(): string {
	return VERIFIER_CONTRACT_ADDRESS;
}

// Get BSC Testnet explorer link
export function getExplorerLink(address: string): string {
	return `${BSC_TESTNET_CONFIG.blockExplorer}/address/${address}`;
}
