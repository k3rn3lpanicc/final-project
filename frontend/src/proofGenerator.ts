// Proof generation and verification using snarkjs
import { groth16 } from 'snarkjs';
import type { CircuitInput } from './zkUtils';

export interface Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export interface PublicSignals {
  valid: string;
  nullifier: string;
  electionId: string;
  A: string[];
}

// Generate zkSNARK proof
export async function generateProof(
  input: CircuitInput,
  wasmPath: string,
  zkeyPath: string,
  onProgress?: (message: string) => void
): Promise<{ proof: Proof; publicSignals: string[] }> {
  try {
    onProgress?.('Loading circuit WASM...');
    
    // Generate witness and proof
    onProgress?.('Generating witness...');
    const { proof, publicSignals } = await groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    onProgress?.('Proof generated successfully!');
    
    return { proof: proof as Proof, publicSignals };
  } catch (error) {
    console.error('Error generating proof:', error);
    throw new Error(`Proof generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Verify proof locally
export async function verifyProof(
  proof: Proof,
  publicSignals: string[],
  verificationKeyPath: string,
  onProgress?: (message: string) => void
): Promise<boolean> {
  try {
    onProgress?.('Loading verification key...');
    
    // Fetch verification key
    const vKeyResponse = await fetch(verificationKeyPath);
    const vKey = await vKeyResponse.json();

    onProgress?.('Verifying proof...');
    
    // Verify the proof
    const isValid = await groth16.verify(vKey, publicSignals, proof);

    onProgress?.(isValid ? '✅ Proof verified!' : '❌ Proof verification failed');
    
    return isValid;
  } catch (error) {
    console.error('Error verifying proof:', error);
    throw new Error(`Proof verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Parse public signals into readable format
export function parsePublicSignals(publicSignals: string[]): PublicSignals {
  return {
    valid: publicSignals[0],
    nullifier: publicSignals[1],
    electionId: publicSignals[2],
    A: publicSignals.slice(3, 259), // 256 bits
  };
}

// Export proof as JSON string
export function exportProof(proof: Proof, publicSignals: string[]): string {
  return JSON.stringify(
    {
      proof,
      publicSignals,
      parsedSignals: parsePublicSignals(publicSignals),
    },
    null,
    2
  );
}
