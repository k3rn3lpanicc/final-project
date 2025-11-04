import './style.css';
import { generateRandomField, generateVoteInput, type VoteCredentials } from './zkUtils';
import { generateProof, verifyProof } from './proofGenerator';
import { voterAPI, type Election } from './api';
import { authService } from './auth';
import { poseidon1 } from 'poseidon-lite';
import { encryptVoteOption } from './encryption';
import { submitVote, getExplorerLink as getVoteExplorerLink } from './electionContract';

// Circuit file paths
const WASM_PATH = '/circuit/VoteScheme.wasm';
const ZKEY_PATH = '/circuit/VoteScheme_final.zkey';
const VKEY_PATH = '/circuit/verification_key.json';

// Simplified credential storage - one per election
interface VoterCredentialData {
	electionId: number;
	credentials: VoteCredentials;
	requestId?: string;
	requestStatus?: 'pending' | 'approved' | 'rejected' | 'auto_rejected';
	createdAt: number;
}

let voterCredentials: Map<number, VoterCredentialData> = new Map();
let elections: Election[] = [];
let selectedElectionId: number | null = null;

// DOM Elements
const app = document.querySelector<HTMLDivElement>('#app')!;

// Load credentials from localStorage
function loadCredentials() {
	const stored = localStorage.getItem('simplifiedVoterCredentials');
	if (stored) {
		try {
			const parsed = JSON.parse(stored);
			voterCredentials = new Map(
				Object.entries(parsed).map(([key, value]: [string, any]) => [
					parseInt(key),
					{
						...value,
						credentials: {
							ID: BigInt(value.credentials.ID),
							X: BigInt(value.credentials.X),
							Xp: BigInt(value.credentials.Xp),
						},
					},
				])
			);
			console.log('Loaded credentials from localStorage:', voterCredentials.size);
		} catch (e) {
			console.error('Failed to parse credentials:', e);
			voterCredentials = new Map();
		}
	}
}

// Save credentials to localStorage
function saveCredentials() {
	const toSave: any = {};
	voterCredentials.forEach((value, key) => {
		toSave[key] = {
			...value,
			credentials: {
				ID: value.credentials.ID.toString(),
				X: value.credentials.X.toString(),
				Xp: value.credentials.Xp.toString(),
			},
		};
	});
	localStorage.setItem('simplifiedVoterCredentials', JSON.stringify(toSave));
	console.log('Saved credentials to localStorage:', voterCredentials.size);
}

function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
	const timestamp = new Date().toLocaleTimeString();
	const logEntry = document.createElement('div');
	logEntry.className = `log-entry log-${type}`;
	logEntry.textContent = `[${timestamp}] ${message}`;
	const logDiv = document.querySelector('#log');
	if (logDiv) {
		logDiv.appendChild(logEntry);
		logDiv.scrollTop = logDiv.scrollHeight;
	}
	console.log(message);
}

// Initialize app
async function initApp() {
	loadCredentials();

	app.innerHTML = `
		<div class="container">
			<header>
				<div class="header-content">
					<div>
						<h1>🗳️ Voter Dashboard</h1>
						<p>Zero-Knowledge Proof Voting System</p>
					</div>
					<button id="logoutBtn" class="btn btn-secondary">Logout</button>
				</div>
			</header>
			
			<div class="main-content">
				<div id="electionsSection">
					${renderElectionsSection()}
				</div>
				
				<div id="votingSection" style="display: none;">
					${renderVotingSection()}
				</div>
			</div>
			
			<div class="log-section">
				<h3>📋 Activity Log</h3>
				<div id="log" class="log-container"></div>
			</div>
			
			<footer>
				<p>© 2024 zkSNARK Voting System. All rights reserved.</p>
				<p style="margin-top: 0.5rem; font-size: 0.85rem;">Powered by Zero-Knowledge Proofs</p>
			</footer>
		</div>
	`;

	attachEventListeners();
	await loadElections();
}

function renderElectionsSection() {
	return `
		<div class="section">
			<h2>🗳️ Available Elections</h2>
			<p>Select an election to participate in</p>
			<div id="electionsList" class="elections-grid">
				${
					elections.length === 0
						? '<p>Loading elections...</p>'
						: elections.map((e) => renderElectionCard(e)).join('')
				}
			</div>
		</div>
	`;
}

function renderElectionCard(election: Election) {
	const credData = voterCredentials.get(election.id);
	const hasCredential = !!credData;
	const hasRequest = hasCredential && credData.requestId;
	const isApproved = hasRequest && credData.requestStatus === 'approved';
	const isPending = hasRequest && credData.requestStatus === 'pending';
	const isRejected =
		hasRequest &&
		(credData.requestStatus === 'rejected' || credData.requestStatus === 'auto_rejected');

	let statusBadge = '';
	let actionButton = '';

	if (isApproved) {
		statusBadge = '<span class="badge badge-success">✓ Ready to Vote</span>';
		actionButton = `<button class="btn btn-success" onclick="window.startVoting(${election.id})">🗳️ Vote Now</button>`;
	} else if (isPending) {
		statusBadge = '<span class="badge badge-warning">⏳ Pending Approval</span>';
		actionButton = `<button class="btn btn-secondary" disabled>Waiting for Admin</button>`;
	} else if (isRejected) {
		statusBadge = '<span class="badge badge-danger">❌ Rejected</span>';
		actionButton = `<button class="btn btn-primary" onclick="window.registerForElection(${election.id})">📝 Register Again</button>`;
	} else {
		statusBadge = '<span class="badge badge-secondary">Not Registered</span>';
		actionButton = `<button class="btn btn-primary" onclick="window.registerForElection(${election.id})">📝 Register to Vote</button>`;
	}

	return `
		<div class="election-card">
			<div class="election-header">
				<h3>${election.name}</h3>
				${statusBadge}
			</div>
			<div class="election-body">
				<p class="election-description">${election.description || 'No description available'}</p>
				<div class="election-meta">
					<span class="meta-item">📋 Election ID: ${election.id}</span>
					<span class="meta-item">📊 ${election.options?.length || 0} Options</span>
					<span class="meta-item">${election.isActive ? '🟢 Active' : '🔴 Inactive'}</span>
				</div>
				${
					election.options && election.options.length > 0
						? `
					<div class="election-options-preview">
						<strong>Options:</strong> ${election.options.join(', ')}
					</div>
				`
						: ''
				}
			</div>
			<div class="election-actions">
				${actionButton}
			</div>
		</div>
	`;
}

function renderVotingSection() {
	if (!selectedElectionId) return '';

	const election = elections.find((e) => e.id === selectedElectionId);
	const credData = voterCredentials.get(selectedElectionId);

	if (!election || !credData) return '';

	return `
		<div class="section">
			<button class="btn btn-secondary" onclick="window.backToElections()">← Back to Elections</button>
			
			<h2>🗳️ Voting: ${election.name}</h2>
			
			<div class="voting-container">
				<div id="voteOptionsSection" class="vote-section">
					<h3>Select Your Choice</h3>
					<div class="vote-options">
						${election.options
							.map(
								(option, index) => `
							<label class="vote-option">
								<input type="radio" name="voteOption" value="${index}" />
								<span class="option-text">${option}</span>
							</label>
						`
							)
							.join('')}
					</div>
				</div>
				
				<div class="vote-actions">
					<button id="castVoteBtn" class="btn btn-success btn-lg" disabled>
						🗳️ Cast Vote
					</button>
				</div>
				
				<div id="votingProgress" style="display: none;" class="voting-progress">
					<h3>Voting in Progress...</h3>
					<div class="progress-steps">
						<div class="progress-step" id="step-proof">
							<div class="step-icon">⏳</div>
							<div class="step-text">Generating Zero-Knowledge Proof...</div>
						</div>
						<div class="progress-step" id="step-verify">
							<div class="step-icon">⏳</div>
							<div class="step-text">Verifying Proof Locally...</div>
						</div>
						<div class="progress-step" id="step-submit">
							<div class="step-icon">⏳</div>
							<div class="step-text">Submitting to Blockchain...</div>
						</div>
					</div>
				</div>
				
				<div id="voteResult" style="display: none;" class="vote-result">
				</div>
				
				<div class="technical-info collapsed">
					<button class="btn btn-sm btn-secondary" onclick="window.toggleTechnicalInfo()">
						📊 Show Technical Details
					</button>
					<div id="technicalDetails" style="display: none;">
						<h4>Credentials</h4>
						<button class="btn btn-xs btn-info" onclick="window.downloadCredentials()">💾 Download Credentials</button>
						<pre style="font-size: 0.75rem; overflow-x: auto;">${JSON.stringify(
							{
								voterId:
									credData.credentials.ID.toString().substring(0, 20) + '...',
								electionId: selectedElectionId,
							},
							null,
							2
						)}</pre>
						
						<div id="proofDetails" style="display: none;">
							<h4>Generated Proof</h4>
							<button class="btn btn-xs btn-info" onclick="window.downloadProof()">💾 Download Proof</button>
							<pre id="proofData" style="font-size: 0.75rem; overflow-x: auto;"></pre>
						</div>
					</div>
				</div>
			</div>
		</div>
	`;
}

async function loadElections() {
	try {
		log('Loading elections...', 'info');
		elections = await voterAPI.getActiveElections();
		log(`Loaded ${elections.length} elections`, 'success');

		// Update UI
		const electionsList = document.querySelector('#electionsList');
		if (electionsList) {
			electionsList.innerHTML = elections.map((e) => renderElectionCard(e)).join('');
		}

		// Check status of pending requests
		for (const [electionId, credData] of voterCredentials.entries()) {
			if (credData.requestId && credData.requestStatus === 'pending') {
				await checkRequestStatus(electionId, credData.requestId);
			}
		}
	} catch (error) {
		log(
			`Failed to load elections: ${error instanceof Error ? error.message : 'Unknown error'}`,
			'error'
		);
	}
}

async function checkRequestStatus(electionId: number, requestId: string) {
	try {
		const request = await voterAPI.getRequest(requestId);
		const credData = voterCredentials.get(electionId);
		if (credData && credData.requestStatus !== request.status) {
			credData.requestStatus = request.status;
			saveCredentials();

			if (request.status === 'approved') {
				log(`Your registration for election ${electionId} has been approved!`, 'success');
			} else if (request.status === 'rejected' || request.status === 'auto_rejected') {
				log(`Your registration for election ${electionId} was rejected.`, 'error');
			}

			// Refresh elections list
			const electionsList = document.querySelector('#electionsList');
			if (electionsList) {
				electionsList.innerHTML = elections.map((e) => renderElectionCard(e)).join('');
			}
		}
	} catch (error) {
		console.error(`Failed to check status for request ${requestId}:`, error);
	}
}

// Global window functions
(window as any).registerForElection = async function (electionId: number) {
	log(`Starting registration for election ${electionId}...`, 'info');

	// Step 3: Generate credentials
	let credData = voterCredentials.get(electionId);
	if (
		!credData ||
		credData.requestStatus === 'rejected' ||
		credData.requestStatus === 'auto_rejected'
	) {
		log('Generating credentials...', 'info');
		const credentials: VoteCredentials = {
			ID: generateRandomField(),
			X: generateRandomField(),
			Xp: generateRandomField(),
		};
		credData = {
			electionId,
			credentials,
			createdAt: Date.now(),
		};
		voterCredentials.set(electionId, credData);
		saveCredentials();
		log('Credentials generated and saved', 'success');
	}

	// Step 4: Show registration form
	showRegistrationForm(electionId);
};

function showRegistrationForm(electionId: number) {
	const election = elections.find((e) => e.id === electionId);
	if (!election) {
		log('Election not found', 'error');
		return;
	}

	const formHtml = `
		<div class="modal-overlay" onclick="window.closeRegistrationForm()">
			<div class="modal registration-modal" onclick="event.stopPropagation()">
				<div class="modal-header">
					<h2>📝 Register for: ${election.name}</h2>
					<button class="modal-close" onclick="window.closeRegistrationForm()">×</button>
				</div>
				<div class="modal-body">
					<p class="note">✅ Credentials have been generated and saved automatically</p>
					<form id="registrationForm" class="form">
						<div class="form-group">
							<label for="fullName">Full Name:</label>
							<input type="text" id="fullName" name="fullName" required />
						</div>
						<div class="form-group">
							<label for="passportNumber">Passport Number:</label>
							<input type="text" id="passportNumber" name="passportNumber" required />
						</div>
						<div class="form-group">
							<label for="dateOfBirth">Date of Birth:</label>
							<input type="date" id="dateOfBirth" name="dateOfBirth" required />
						</div>
						<div class="form-group">
							<label for="nationality">Nationality:</label>
							<input type="text" id="nationality" name="nationality" required />
						</div>
						<div class="form-group">
							<label for="passportImage">Passport Image:</label>
							<input type="file" id="passportImage" name="passportImage" accept="image/*" required />
						</div>
						<div class="form-group">
							<label for="photo">Your Photo:</label>
							<input type="file" id="photo" name="photo" accept="image/*" required />
						</div>
						<button type="submit" class="btn btn-primary">📤 Submit Registration</button>
					</form>
				</div>
			</div>
		</div>
	`;

	document.body.insertAdjacentHTML('beforeend', formHtml);

	// Attach form submit handler
	const form = document.querySelector('#registrationForm') as HTMLFormElement;
	if (form) {
		form.addEventListener('submit', (e) => handleRegistrationSubmit(e, electionId));
	}
}

(window as any).closeRegistrationForm = function () {
	const overlay = document.querySelector('.modal-overlay');
	if (overlay) {
		overlay.remove();
	}
};

async function handleRegistrationSubmit(e: Event, electionId: number) {
	e.preventDefault();

	const form = e.target as HTMLFormElement;
	const formData = new FormData(form);

	const credData = voterCredentials.get(electionId);
	if (!credData) {
		log('Credentials not found! Please try again.', 'error');
		return;
	}

	// Add credential data to form
	formData.append('voterId', credData.credentials.ID.toString());
	formData.append('secretX', credData.credentials.X.toString());
	const hashXp = poseidon1([credData.credentials.Xp]);
	formData.append('hashXp', hashXp.toString());
	formData.append('electionId', electionId.toString());

	try {
		log('Submitting registration...', 'info');
		const request = await voterAPI.submitRegistration(formData);

		// Update credential data
		credData.requestId = request.id;
		credData.requestStatus = 'pending';
		saveCredentials();

		log('Registration submitted successfully! Waiting for admin approval...', 'success');

		// Close form
		(window as any).closeRegistrationForm();

		// Refresh elections list
		const electionsList = document.querySelector('#electionsList');
		if (electionsList) {
			electionsList.innerHTML = elections.map((e) => renderElectionCard(e)).join('');
		}

		// Start polling for approval
		startPollingRequest(electionId, request.id);
	} catch (error) {
		log(
			`Failed to submit registration: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
			'error'
		);
	}
}

function startPollingRequest(electionId: number, requestId: string) {
	const interval = setInterval(async () => {
		const credData = voterCredentials.get(electionId);
		if (!credData || credData.requestId !== requestId) {
			clearInterval(interval);
			return;
		}

		if (credData.requestStatus !== 'pending') {
			clearInterval(interval);
			return;
		}

		await checkRequestStatus(electionId, requestId);
	}, 5000); // Check every 5 seconds
}

(window as any).startVoting = function (electionId: number) {
	selectedElectionId = electionId;

	// Hide elections section, show voting section
	const electionsSection = document.querySelector('#electionsSection') as HTMLElement;
	const votingSection = document.querySelector('#votingSection') as HTMLElement;

	if (electionsSection) electionsSection.style.display = 'none';
	if (votingSection) {
		votingSection.innerHTML = renderVotingSection();
		votingSection.style.display = 'block';
		attachVotingListeners();
	}
};

(window as any).backToElections = function () {
	selectedElectionId = null;

	const electionsSection = document.querySelector('#electionsSection') as HTMLElement;
	const votingSection = document.querySelector('#votingSection') as HTMLElement;

	if (electionsSection) electionsSection.style.display = 'block';
	if (votingSection) votingSection.style.display = 'none';
};

function attachVotingListeners() {
	const voteOptions = document.querySelectorAll('input[name="voteOption"]');
	const castVoteBtn = document.querySelector('#castVoteBtn') as HTMLButtonElement;

	let selectedOptionIndex: number | null = null;

	voteOptions.forEach((radio) => {
		radio.addEventListener('change', (e) => {
			const target = e.target as HTMLInputElement;
			selectedOptionIndex = parseInt(target.value);
			if (castVoteBtn) castVoteBtn.disabled = false;
		});
	});

	if (castVoteBtn) {
		castVoteBtn.addEventListener('click', async () => {
			if (selectedOptionIndex === null) {
				log('Please select an option', 'error');
				return;
			}

			await handleCastVote(selectedOptionIndex);
		});
	}
}

async function handleCastVote(selectedOptionIndex: number) {
	if (!selectedElectionId) {
		log('No election selected', 'error');
		return;
	}

	const credData = voterCredentials.get(selectedElectionId);
	if (!credData || !credData.requestId || credData.requestStatus !== 'approved') {
		log('You are not approved to vote in this election', 'error');
		return;
	}

	const election = elections.find((e) => e.id === selectedElectionId);
	if (!election) {
		log('Election not found', 'error');
		return;
	}

	// Show progress UI
	const voteOptionsSection = document.querySelector('#voteOptionsSection') as HTMLElement;
	const voteActions = document.querySelector('.vote-actions') as HTMLElement;
	const votingProgress = document.querySelector('#votingProgress') as HTMLElement;
	const voteResult = document.querySelector('#voteResult') as HTMLElement;

	if (voteOptionsSection) voteOptionsSection.style.display = 'none';
	if (voteActions) voteActions.style.display = 'none';
	if (votingProgress) votingProgress.style.display = 'block';
	if (voteResult) voteResult.style.display = 'none';

	try {
		// Step 1: Generate proof
		log('Generating zero-knowledge proof...', 'info');
		updateStepStatus('step-proof', 'loading');

		const signature = await voterAPI.getSignature(credData.requestId);
		const adminPublicKey = await voterAPI.getAdminPublicKey();

		const signatureData = {
			R8x: BigInt(signature.signatureR8x),
			R8y: BigInt(signature.signatureR8y),
			S: BigInt(signature.signatureS),
			Ax: BigInt(adminPublicKey.publicKeyX),
			Ay: BigInt(adminPublicKey.publicKeyY),
		};

		const input = await generateVoteInput(
			credData.credentials,
			BigInt(selectedElectionId),
			signatureData
		);

		const { proof, publicSignals } = await generateProof(input, WASM_PATH, ZKEY_PATH);
		log('Proof generated successfully', 'success');
		updateStepStatus('step-proof', 'success');

		// Store proof for download
		(window as any).currentProof = proof;
		(window as any).currentPublicSignals = publicSignals;

		// Show proof in technical details
		const proofData = document.querySelector('#proofData');
		if (proofData) {
			proofData.textContent = JSON.stringify(proof, null, 2);
		}
		const proofDetails = document.querySelector('#proofDetails') as HTMLElement;
		if (proofDetails) {
			proofDetails.style.display = 'block';
		}

		// Step 2: Verify proof locally
		log('Verifying proof locally...', 'info');
		updateStepStatus('step-verify', 'loading');

		const isValid = await verifyProof(proof, publicSignals, VKEY_PATH);
		if (!isValid) {
			throw new Error('Proof verification failed');
		}
		log('Proof verified successfully', 'success');
		updateStepStatus('step-verify', 'success');

		// Step 3: Submit to blockchain
		log('Submitting vote to blockchain...', 'info');
		updateStepStatus('step-submit', 'loading');

		const { encryptedData } = await encryptVoteOption(selectedOptionIndex);

		const result = await submitVote(proof, publicSignals, encryptedData);

		if (!result.success || !result.txHash) {
			throw new Error(result.error || 'Failed to submit vote');
		}

		const txHash = result.txHash;

		log('Vote submitted successfully!', 'success');
		updateStepStatus('step-submit', 'success');

		// Show result
		if (votingProgress) votingProgress.style.display = 'none';
		if (voteResult) {
			voteResult.innerHTML = `
				<div class="success-box">
					<h3>✅ Vote Cast Successfully!</h3>
					<p>Your vote for <strong>"${
						election.options[selectedOptionIndex]
					}"</strong> has been recorded on the blockchain.</p>
					<p class="note">Transaction Hash: <a href="${getVoteExplorerLink(
						txHash
					)}" target="_blank">${txHash.substring(0, 20)}...</a></p>
					<button class="btn btn-primary" onclick="window.backToElections()">← Back to Elections</button>
				</div>
			`;
			voteResult.style.display = 'block';
		}
	} catch (error) {
		log(
			`Failed to cast vote: ${error instanceof Error ? error.message : 'Unknown error'}`,
			'error'
		);

		// Update failed step
		const steps = ['step-proof', 'step-verify', 'step-submit'];
		for (const step of steps) {
			const el = document.querySelector(`#${step}`) as HTMLElement;
			if (el && el.querySelector('.step-icon')?.textContent === '⏳') {
				updateStepStatus(step, 'error');
				break;
			}
		}

		// Show error
		if (votingProgress) votingProgress.style.display = 'none';
		if (voteResult) {
			voteResult.innerHTML = `
				<div class="error-box">
					<h3>❌ Voting Failed</h3>
					<p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>
					<button class="btn btn-primary" onclick="location.reload()">Try Again</button>
				</div>
			`;
			voteResult.style.display = 'block';
		}
	}
}

function updateStepStatus(stepId: string, status: 'loading' | 'success' | 'error') {
	const step = document.querySelector(`#${stepId}`) as HTMLElement;
	if (!step) return;

	const icon = step.querySelector('.step-icon');
	if (!icon) return;

	step.className = 'progress-step';

	if (status === 'loading') {
		step.classList.add('loading');
		icon.textContent = '⏳';
	} else if (status === 'success') {
		step.classList.add('success');
		icon.textContent = '✅';
	} else if (status === 'error') {
		step.classList.add('error');
		icon.textContent = '❌';
	}
}

(window as any).toggleTechnicalInfo = function () {
	const details = document.querySelector('#technicalDetails') as HTMLElement;
	const btn = event?.target as HTMLButtonElement;

	if (details) {
		if (details.style.display === 'none') {
			details.style.display = 'block';
			if (btn) btn.textContent = '📊 Hide Technical Details';
		} else {
			details.style.display = 'none';
			if (btn) btn.textContent = '📊 Show Technical Details';
		}
	}
};

(window as any).downloadCredentials = function () {
	if (!selectedElectionId) return;

	const credData = voterCredentials.get(selectedElectionId);
	if (!credData) return;

	const data = JSON.stringify(
		{
			electionId: selectedElectionId,
			credentials: {
				ID: credData.credentials.ID.toString(),
				X: credData.credentials.X.toString(),
				Xp: credData.credentials.Xp.toString(),
			},
			requestId: credData.requestId,
			createdAt: credData.createdAt,
		},
		null,
		2
	);

	const blob = new Blob([data], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `credentials-election-${selectedElectionId}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	log('Credentials downloaded', 'success');
};

(window as any).downloadProof = function () {
	const proof = (window as any).currentProof;
	const publicSignals = (window as any).currentPublicSignals;

	if (!proof || !publicSignals) {
		log('No proof available to download', 'error');
		return;
	}

	const data = JSON.stringify(
		{
			proof,
			publicSignals,
		},
		null,
		2
	);

	const blob = new Blob([data], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `proof-election-${selectedElectionId}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	log('Proof downloaded', 'success');
};

function attachEventListeners() {
	// Logout button
	const logoutBtn = document.querySelector('#logoutBtn');
	if (logoutBtn) {
		logoutBtn.addEventListener('click', handleLogout);
	}
}

async function handleLogout() {
	if (confirm('Are you sure you want to logout?')) {
		try {
			await authService.logout();
			window.location.href = '/login.html';
		} catch (error) {
			console.error('Logout error:', error);
			// Still redirect even if logout API call fails
			authService.clearTokens();
			window.location.href = '/login.html';
		}
	}
}

// Check auth and init app
(async () => {
	try {
		if (authService.isAuthenticated()) {
			await initApp();
		} else {
			window.location.href = '/login.html';
		}
	} catch (error) {
		console.error('Failed to initialize app:', error);
		app.innerHTML = `
			<div class="container">
				<div class="section">
					<h2>Error</h2>
					<p style="color: var(--danger);">Failed to load the application. Please try refreshing the page.</p>
					<p style="color: var(--text-secondary); font-size: 0.9rem;">${error instanceof Error ? error.message : 'Unknown error'}</p>
					<button class="btn btn-primary" onclick="location.reload()">Refresh Page</button>
				</div>
			</div>
		`;
	}
})();
