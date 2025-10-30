import './style.css';
import {
	generateRandomField,
	generateVoteInput,
	verifySignature,
	type VoteCredentials,
} from './zkUtils';
import { generateProof, verifyProof, parsePublicSignals, exportProof } from './proofGenerator';

// Fixed issuer private key (for demo purposes - in production, this would be server-side)
const ISSUER_PRIVATE_KEY = new Uint8Array([
	0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1,
]);

// Circuit file paths
const WASM_PATH = '/circuit/VoteScheme.wasm';
const ZKEY_PATH = '/circuit/VoteScheme_final.zkey';
const VKEY_PATH = '/circuit/verification_key.json';

let currentCredentials: VoteCredentials | null = null;
let currentProof: any = null;
let currentPublicSignals: string[] = [];

// DOM Elements
const generateCredBtn = document.querySelector<HTMLButtonElement>('#generateCred')!;
const generateProofBtn = document.querySelector<HTMLButtonElement>('#generateProof')!;
const verifyProofBtn = document.querySelector<HTMLButtonElement>('#verifyProof')!;
const credentialsDiv = document.querySelector<HTMLDivElement>('#credentials')!;
const proofOutputDiv = document.querySelector<HTMLDivElement>('#proofOutput')!;
const logDiv = document.querySelector<HTMLDivElement>('#log')!;

function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
	const timestamp = new Date().toLocaleTimeString();
	const logEntry = document.createElement('div');
	logEntry.className = `log-entry log-${type}`;
	logEntry.textContent = `[${timestamp}] ${message}`;
	logDiv.appendChild(logEntry);
	logDiv.scrollTop = logDiv.scrollHeight;
	console.log(message);
}

// Step 1: Generate voter credentials
generateCredBtn.addEventListener('click', async () => {
	try {
		log('Generating random voter credentials...');
		generateCredBtn.disabled = true;

		// Generate random credentials
		const credentials: VoteCredentials = {
			ID: generateRandomField(),
			X: generateRandomField(),
			Xp: generateRandomField(),
		};

		currentCredentials = credentials;

		// Display credentials
		credentialsDiv.innerHTML = `
      <h3>✅ Voter Credentials Generated</h3>
      <div class="credential-item">
        <strong>Voter ID:</strong>
        <div class="value">${credentials.ID.toString().slice(0, 40)}...</div>
      </div>
      <div class="credential-item">
        <strong>Secret X:</strong>
        <div class="value">${credentials.X.toString().slice(0, 40)}...</div>
      </div>
      <div class="credential-item">
        <strong>Secret Xp:</strong>
        <div class="value">${credentials.Xp.toString().slice(0, 40)}...</div>
      </div>
      <p class="note">These credentials would normally be issued by a trusted authority.</p>
    `;

		log('Credentials generated successfully!', 'success');
		log('Verifying signature validity...');

		// Verify signature can be generated
		const electionId = 12345n; // Demo election ID
		const isValid = await verifySignature(credentials, electionId, ISSUER_PRIVATE_KEY);

		if (isValid) {
			log('✅ Signature verification passed!', 'success');
			generateProofBtn.disabled = false;
		} else {
			log('❌ Signature verification failed!', 'error');
		}
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	} finally {
		generateCredBtn.disabled = false;
	}
});

// Step 2: Generate zkSNARK proof
generateProofBtn.addEventListener('click', async () => {
	if (!currentCredentials) {
		log('Please generate credentials first!', 'error');
		return;
	}

	try {
		log('Starting proof generation...');
		generateProofBtn.disabled = true;
		generateProofBtn.textContent = 'Generating...';

		const electionId = 12345n; // Demo election ID

		// Generate circuit input
		log('Computing circuit input...');
		const input = await generateVoteInput(currentCredentials, electionId, ISSUER_PRIVATE_KEY);

		log('Circuit input prepared. Starting zkSNARK proof generation...');
		log('⏳ This may take 10-30 seconds...');

		// Generate proof
		const { proof, publicSignals } = await generateProof(input, WASM_PATH, ZKEY_PATH, (msg) =>
			log(msg)
		);

		currentProof = proof;
		currentPublicSignals = publicSignals;

		// Parse and display public signals
		const parsed = parsePublicSignals(publicSignals);

		proofOutputDiv.innerHTML = `
      <h3>✅ Proof Generated Successfully!</h3>
      
      <div class="proof-section">
        <h4>Public Signals</h4>
        <div class="credential-item">
          <strong>Nullifier Hash:</strong>
          <div class="value">${parsed.nh.slice(0, 40)}...</div>
        </div>
        <div class="credential-item">
          <strong>Election ID:</strong>
          <div class="value">${parsed.electionId}</div>
        </div>
        <div class="credential-item">
          <strong>Issuer Public Key:</strong>
          <div class="value">${parsed.A.length} bits</div>
        </div>
      </div>
      
      <div class="proof-section">
        <h4>Proof Components</h4>
        <div class="credential-item">
          <strong>pi_a:</strong>
          <div class="value small">[${proof.pi_a.length} elements]</div>
        </div>
        <div class="credential-item">
          <strong>pi_b:</strong>
          <div class="value small">[${proof.pi_b.length}x${proof.pi_b[0]?.length} elements]</div>
        </div>
        <div class="credential-item">
          <strong>pi_c:</strong>
          <div class="value small">[${proof.pi_c.length} elements]</div>
        </div>
      </div>
      
      <button id="downloadProof" class="download-btn">📥 Download Proof JSON</button>
    `;

		// Add download functionality
		document.querySelector('#downloadProof')?.addEventListener('click', () => {
			const json = exportProof(proof, publicSignals);
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `proof_${Date.now()}.json`;
			a.click();
			URL.revokeObjectURL(url);
			log('Proof downloaded!', 'success');
		});

		log('✅ Proof generation complete!', 'success');
		verifyProofBtn.disabled = false;
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
		proofOutputDiv.innerHTML = `<p class="error">❌ Proof generation failed. Check console for details.</p>`;
	} finally {
		generateProofBtn.disabled = false;
		generateProofBtn.textContent = '2. Generate zkSNARK Proof';
	}
});

// Step 3: Verify proof locally
verifyProofBtn.addEventListener('click', async () => {
	if (!currentProof || !currentPublicSignals.length) {
		log('No proof to verify! Generate a proof first.', 'error');
		return;
	}

	try {
		log('Starting proof verification...');
		verifyProofBtn.disabled = true;
		verifyProofBtn.textContent = 'Verifying...';

		// Verify proof
		const isValid = await verifyProof(currentProof, currentPublicSignals, VKEY_PATH, (msg) =>
			log(msg)
		);

		if (isValid) {
			log('🎉 PROOF IS VALID! Vote would be accepted on-chain.', 'success');

			// Add verification result to display
			const resultDiv = document.createElement('div');
			resultDiv.className = 'verification-result success';
			resultDiv.innerHTML = `
        <h3>✅ Verification Successful!</h3>
        <p>This proof can now be submitted to the smart contract.</p>
        <p>The nullifier ensures this vote cannot be cast twice.</p>
      `;
			proofOutputDiv.appendChild(resultDiv);
		} else {
			log('❌ PROOF IS INVALID!', 'error');

			const resultDiv = document.createElement('div');
			resultDiv.className = 'verification-result error';
			resultDiv.innerHTML = `
        <h3>❌ Verification Failed!</h3>
        <p>This proof would be rejected by the smart contract.</p>
      `;
			proofOutputDiv.appendChild(resultDiv);
		}
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	} finally {
		verifyProofBtn.disabled = false;
		verifyProofBtn.textContent = '3. Verify Proof';
	}
});

// Initialize
log('zkSNARK Voting Demo Ready!', 'success');
log('Click "Generate Credentials" to start...');
