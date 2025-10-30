// On-chain verification using ethers.js
import { ethers } from 'ethers';
import type { Proof } from './proofGenerator';

// Binance Smart Chain Testnet configuration
const BSC_TESTNET_CONFIG = {
  chainId: 97,
  name: 'BSC Testnet',
  rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
  blockExplorer: 'https://testnet.bscscan.com',
};

// Placeholder contract address (user will update this)
const VERIFIER_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Update with actual deployed address

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
  return {
    pA: [proof.pi_a[0], proof.pi_a[1]],
    pB: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    pC: [proof.pi_c[0], proof.pi_c[1]],
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
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    
    if (chainId !== '0x61') { // 0x61 = 97 in hex
      // Try to switch to BSC Testnet
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x61' }],
        });
      } catch (switchError: any) {
        // Chain not added, try to add it
        if (switchError.code === 4902) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x61',
                chainName: 'BSC Testnet',
                nativeCurrency: {
                  name: 'BNB',
                  symbol: 'tBNB',
                  decimals: 18,
                },
                rpcUrls: [BSC_TESTNET_CONFIG.rpcUrl],
                blockExplorerUrls: [BSC_TESTNET_CONFIG.blockExplorer],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }
    }

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

    // Create contract instance
    const verifierContract = new ethers.Contract(
      VERIFIER_CONTRACT_ADDRESS,
      VERIFIER_ABI,
      signer
    );

    // Format proof for Solidity
    const formattedProof = formatProofForContract(proof, publicSignals);

    onProgress?.('Calling verifyProof on BSC Testnet...');

    // Call verifyProof (this is a view function, no gas needed)
    const isValid = await verifierContract.verifyProof(
      formattedProof.pA,
      formattedProof.pB,
      formattedProof.pC,
      formattedProof.pubSignals
    );

    onProgress?.(isValid ? '✅ On-chain verification successful!' : '❌ On-chain verification failed!');

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
