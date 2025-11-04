// Interaction with the ZKVoting Election contract
import { ethers } from 'ethers';
import type { Proof } from './proofGenerator';
import ElectionABI from '../../contracts/ElectionABI.json';

// Contract addresses (will be updated)
const ELECTION_CONTRACT_ADDRESS = '0x814E3417224f85C0c1508d17076447A1bC8a43b7'; // Placeholder
const BSC_TESTNET_RPC = 'https://mainnet.skalenodes.com/v1/honorable-steel-rasalhague';
const FIXED_PRIVATE_KEY = 'c2fc03cf10991ca1dc68e7da6fa42e2fb4a2261be7dd3355377c8abe590697f9';

// Format proof for Solidity contract
function formatProofForContract(proof: Proof, publicSignals: string[]) {
	const pA = [proof.pi_a[0], proof.pi_a[1]];
	const pB = [
		[proof.pi_b[0][1], proof.pi_b[0][0]],
		[proof.pi_b[1][1], proof.pi_b[1][0]],
	];
	const pC = [proof.pi_c[0], proof.pi_c[1]];

	return {
		pA,
		pB,
		pC,
		pubSignals: publicSignals,
	};
}

/**
 * Submit vote to the election contract
 * @param proof The zkSNARK proof
 * @param publicSignals The public signals from proof generation
 * @param encryptedVote The encrypted vote option
 * @param onProgress Progress callback
 * @returns Transaction result
 */
export async function submitVote(
	proof: Proof,
	publicSignals: string[],
	encryptedVote: string,
	onProgress?: (message: string) => void
): Promise<{ success: boolean; txHash?: string; error?: string }> {
	try {
		onProgress?.('Connecting to blockchain...');

		// Create provider and signer with fixed private key
		const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
		const signer = new ethers.Wallet(FIXED_PRIVATE_KEY, provider);
		
		const address = await signer.getAddress();
		onProgress?.(`Using wallet: ${address.slice(0, 6)}...${address.slice(-4)}`);

		onProgress?.('Loading election contract...');

		// Check if contract exists
		const code = await provider.getCode(ELECTION_CONTRACT_ADDRESS);
		if (code === '0x') {
			throw new Error(
				`No contract found at address ${ELECTION_CONTRACT_ADDRESS}. Please ensure the contract is deployed.`
			);
		}
		onProgress?.('✅ Contract found');

		// Create contract instance
		const electionContract = new ethers.Contract(
			ELECTION_CONTRACT_ADDRESS,
			ElectionABI,
			signer
		);

		// Check if nullifier has already been used (prevent double voting)
		const nullifierHash = publicSignals[1]; // Nullifier is at index 1
		const electionId = publicSignals[2]; // Election ID is at index 2
		
		onProgress?.('Checking if you have already voted...');
		const hasVoted = await electionContract.isNullifierUsed(electionId, nullifierHash);
		
		if (hasVoted) {
			throw new Error('You have already voted in this election! Each credential can only vote once.');
		}
		
		onProgress?.('✅ Eligible to vote');

		// Format proof for contract
		const formattedProof = formatProofForContract(proof, publicSignals);

		onProgress?.('Submitting vote transaction...');

		console.log('Submitting vote with:', {
			pA: formattedProof.pA,
			pB: formattedProof.pB,
			pC: formattedProof.pC,
			pubSignalsCount: formattedProof.pubSignals.length,
			encryptedVote,
			electionId,
			nullifierHash,
		});

		// Submit vote transaction
		const tx = await electionContract.submitVote(
			formattedProof.pA,
			formattedProof.pB,
			formattedProof.pC,
			formattedProof.pubSignals,
			encryptedVote
		);

		onProgress?.('⏳ Waiting for transaction confirmation...');
		const receipt = await tx.wait();

		onProgress?.(`✅ Vote submitted! Tx: ${receipt.hash}`);

		return {
			success: true,
			txHash: receipt.hash,
		};
	} catch (error: any) {
		console.error('Vote submission error:', error);

		let errorMessage = 'Unknown error';
		if (error.message) {
			errorMessage = error.message;
		} else if (error.reason) {
			errorMessage = error.reason;
		}

		// Parse common errors
		if (errorMessage.includes('Nullifier used') || errorMessage.includes('already voted')) {
			errorMessage = 'You have already voted in this election!';
		} else if (errorMessage.includes('Election closed')) {
			errorMessage = 'This election is no longer active!';
		} else if (errorMessage.includes('Invalid proof')) {
			errorMessage = 'Proof verification failed! Please regenerate your proof.';
		} else if (errorMessage.includes('Issuer A mismatch')) {
			errorMessage = 'Your credentials were not issued by the authorized admin!';
		}

		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Check if a nullifier has been used (i.e., if user has already voted)
 * @param electionId The election ID
 * @param nullifierHash The nullifier hash
 * @returns true if already voted
 */
export async function checkIfVoted(
	electionId: bigint,
	nullifierHash: string
): Promise<boolean> {
	try {
		const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
		const contract = new ethers.Contract(
			ELECTION_CONTRACT_ADDRESS,
			ElectionABI,
			provider
		);

		const isUsed = await contract.isNullifierUsed(electionId, nullifierHash);
		return isUsed;
	} catch (error) {
		console.error('Error checking if voted:', error);
		return false;
	}
}

/**
 * Get election info from contract
 * @param electionId The election ID
 * @returns Election info
 */
export async function getElectionInfo(electionId: bigint): Promise<{
	verifier: string;
	active: boolean;
}> {
	try {
		const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
		const contract = new ethers.Contract(
			ELECTION_CONTRACT_ADDRESS,
			ElectionABI,
			provider
		);

		const info = await contract.elections(electionId);
		return {
			verifier: info.verifier || info[0],
			active: info.active !== undefined ? info.active : info[1],
		};
	} catch (error) {
		console.error('Error getting election info:', error);
		throw error;
	}
}

/**
 * Get the election contract address
 */
export function getElectionContractAddress(): string {
	return ELECTION_CONTRACT_ADDRESS;
}

/**
 * Get explorer link for transaction
 */
export function getExplorerLink(txHash: string): string {
	return `https://testnet.bscscan.com/tx/${txHash}`;
}
