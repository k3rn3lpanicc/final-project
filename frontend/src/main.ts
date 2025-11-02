import './style.css';
import {
	generateRandomField,
	generateVoteInput,
	type VoteCredentials,
} from './zkUtils';
import { generateProof, verifyProof, parsePublicSignals, exportProof } from './proofGenerator';
import { verifyProofOnChain, isMetaMaskInstalled, getVerifierContractAddress, getExplorerLink } from './blockchainVerifier';
import { voterAPI, type VoterRequest } from './api';
import { authService } from './auth';
import { poseidon1 } from 'poseidon-lite';

// Circuit file paths
const WASM_PATH = '/circuit/VoteScheme.wasm';
const ZKEY_PATH = '/circuit/VoteScheme_final.zkey';
const VKEY_PATH = '/circuit/verification_key.json';

// Store multiple credentials with metadata
interface CredentialItem {
	id: string; // Unique ID for this credential
	credentials: VoteCredentials;
	createdAt: number;
	name: string; // User-friendly name
	requests: VoterRequest[]; // All requests for this credential
}

let credentialsList: CredentialItem[] = [];
let selectedCredentialId: string | null = null;
let currentProof: any = null;
let currentPublicSignals: string[] = [];
let selectedRequestId: string | null = null;

// DOM Elements
const app = document.querySelector<HTMLDivElement>('#app')!;

// Load credentials from localStorage
function loadCredentials() {
	const stored = localStorage.getItem('voterCredentials');
	if (stored) {
		try {
			const parsed = JSON.parse(stored);
			// Convert BigInt strings back to BigInt
			credentialsList = parsed.map((item: any) => ({
				...item,
				credentials: {
					ID: BigInt(item.credentials.ID),
					X: BigInt(item.credentials.X),
					Xp: BigInt(item.credentials.Xp),
				}
			}));
			console.log('Loaded credentials from localStorage:', credentialsList.length);
		} catch (e) {
			console.error('Failed to parse credentials:', e);
			credentialsList = [];
		}
	}
}

// Save credentials to localStorage
function saveCredentials() {
	// Convert BigInt to string for JSON storage
	const toSave = credentialsList.map(item => ({
		...item,
		credentials: {
			ID: item.credentials.ID.toString(),
			X: item.credentials.X.toString(),
			Xp: item.credentials.Xp.toString(),
		}
	}));
	localStorage.setItem('voterCredentials', JSON.stringify(toSave));
	console.log('Saved credentials to localStorage:', credentialsList.length);
}

// Get selected credential
function getSelectedCredential(): CredentialItem | null {
	return credentialsList.find(c => c.id === selectedCredentialId) || null;
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
function initApp() {
	loadCredentials(); // Load saved credentials
	
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
			
			<nav class="tabs">
				<button class="tab active" data-tab="credentials">My Credentials</button>
				<button class="tab" data-tab="register">Register New</button>
				<button class="tab" data-tab="proof">Generate Proof</button>
			</nav>
			
			<div class="tab-content">
				<div id="tab-credentials" class="tab-pane active">
					${renderCredentialsTab()}
				</div>
				<div id="tab-register" class="tab-pane">
					${renderRegisterTab()}
				</div>
				<div id="tab-proof" class="tab-pane">
					${renderProofTab()}
				</div>
			</div>
			
			<div id="log" class="log"></div>
		</div>
	`;
	
	attachEventListeners();
	startGlobalRefresh(); // Start refreshing all pending requests
}

function renderCredentialsTab() {
	if (credentialsList.length === 0) {
		return `
			<div class="empty-state">
				<h2>📋 No Credentials Yet</h2>
				<p>You haven't created any voter credentials yet.</p>
				<p>Go to the "Register New" tab to create your first credential and submit a registration request.</p>
			</div>
		`;
	}
	
	return `
		<div class="section">
			<h2>📋 My Voter Credentials</h2>
			<p class="note">Manage your voter credentials and their registration requests. Select a credential to generate proofs.</p>
			<div class="credentials-grid">
				${credentialsList.map(cred => renderCredentialCard(cred)).join('')}
			</div>
		</div>
	`;
}

function renderCredentialCard(cred: CredentialItem) {
	const approvedRequests = cred.requests.filter(r => r.status === 'approved');
	const pendingRequests = cred.requests.filter(r => r.status === 'pending');
	const hasApproved = approvedRequests.length > 0;
	const isSelected = cred.id === selectedCredentialId;
	
	return `
		<div class="credential-card ${isSelected ? 'selected' : ''}" data-credential-id="${cred.id}">
			<div class="credential-header">
				<div>
					<h3>${cred.name}</h3>
					<span class="credential-date">Created: ${new Date(cred.createdAt).toLocaleDateString()}</span>
				</div>
				${hasApproved ? '<span class="badge badge-success">✓ Approved</span>' : 
				  pendingRequests.length > 0 ? '<span class="badge badge-warning">⏳ Pending</span>' :
				  '<span class="badge badge-secondary">No Requests</span>'}
			</div>
			
			<div class="credential-info">
				<div class="info-row">
					<span class="label">Voter ID:</span>
					<span class="value-short" title="${cred.credentials.ID.toString()}">${String(cred.credentials.ID).substring(0, 16)}...</span>
				</div>
				<div class="info-row">
					<span class="label">Requests:</span>
					<span class="value">${cred.requests.length} total</span>
				</div>
				${approvedRequests.length > 0 ? `
					<div class="info-row">
						<span class="label">Status:</span>
						<span class="value success">✓ ${approvedRequests.length} Approved</span>
					</div>
				` : ''}
			</div>
			
			<div class="credential-actions">
				${hasApproved ? `
					<button class="btn btn-sm btn-primary" onclick="window.selectCredential('${cred.id}')">
						${isSelected ? '✓ Selected' : '🔐 Use for Proof'}
					</button>
				` : ''}
				<button class="btn btn-sm btn-success" onclick="window.submitNewRequestForCredential('${cred.id}')">
					📤 New Request
				</button>
				<button class="btn btn-sm btn-secondary" onclick="window.viewCredentialDetails('${cred.id}')">
					📋 Details
				</button>
				<button class="btn btn-sm btn-info" onclick="window.downloadCredential('${cred.id}')">
					💾 Download
				</button>
				${!hasApproved ? `
					<button class="btn btn-sm btn-danger" onclick="window.deleteCredential('${cred.id}')">
						🗑️ Delete
					</button>
				` : ''}
			</div>
			
			${cred.requests.length > 0 ? `
				<div class="credential-requests">
					<h4>Registration Requests:</h4>
					${cred.requests.map(req => renderMiniRequestCard(req)).join('')}
				</div>
			` : ''}
		</div>
	`;
}

function renderMiniRequestCard(request: VoterRequest) {
	const statusClass = request.status === 'approved' ? 'status-approved' :
	                    (request.status === 'rejected' || request.status === 'auto_rejected') ? 'status-rejected' : 'status-pending';
	
	return `
		<div class="mini-request-card">
			<div class="mini-request-header">
				<span class="mini-request-id" title="${request.id}">${request.id.substring(0, 8)}...</span>
				<span class="status-badge ${statusClass}">${request.status === 'auto_rejected' ? 'AUTO REJECTED' : request.status.toUpperCase()}</span>
			</div>
			<div class="mini-request-body">
				<p><strong>${request.fullName}</strong> - ${request.passportNumber}</p>
				<p class="mini-request-date">${new Date(request.createdAt || '').toLocaleString()}</p>
			</div>
			${request.status === 'approved' ? `
				<button class="btn btn-xs btn-success" onclick="window.loadSignatureForProof('${request.id}')">
					Generate Proof →
				</button>
			` : ''}
		</div>
	`;
}

function renderRegisterTab() {
	return `
		<div class="section">
			<h2>🆕 Create New Voter Credential</h2>
			<p>Generate new credentials and submit a registration request to the admin.</p>
			
			<div class="form-section">
				<h3>Step 1: Generate Credentials</h3>
				<div class="input-group">
					<input type="text" id="credentialName" placeholder="Enter a name for this credential (e.g., 'Main Account', 'Backup')" />
				</div>
				<button id="generateCred" class="btn btn-primary">🎲 Generate New Credentials</button>
				<div id="newCredentials" class="info-box"></div>
			</div>
			
			<div class="form-section" id="registrationSection" style="display: none;">
				<h3>Step 2: Submit Registration</h3>
				<p>Upload your documents and personal information to register for voting.</p>
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
					<button type="submit" id="submitRegistration" class="btn btn-primary">📤 Submit Registration</button>
				</form>
			</div>
		</div>
	`;
}

function renderProofTab() {
	const selectedCred = getSelectedCredential();
	
	if (!selectedCred) {
		return `
			<div class="empty-state">
				<h2>🔐 No Credential Selected</h2>
				<p>Please go to "My Credentials" tab and select a credential to generate proofs.</p>
			</div>
		`;
	}
	
	const approvedRequests = selectedCred.requests.filter(r => r.status === 'approved');
	
	if (approvedRequests.length === 0) {
		return `
			<div class="empty-state">
				<h2>⏳ No Approved Requests</h2>
				<p>You have selected: <strong>${selectedCred.name}</strong></p>
				<p>This credential has no approved registration requests yet.</p>
				<p>Please wait for admin approval or create a new registration request.</p>
			</div>
		`;
	}
	
	return `
		<div class="section">
			<h2>🔐 Generate Zero-Knowledge Proof</h2>
			<div class="info-box">
				<h4>Selected Credential: ${selectedCred.name}</h4>
				<p>Voter ID: <code>${String(selectedCred.credentials.ID).substring(0, 20)}...</code></p>
				<p class="note">✓ ${approvedRequests.length} approved request(s) available</p>
			</div>
			
			${selectedRequestId ? `
				<div class="info-box success-box">
					<h4>✅ Signature Loaded</h4>
					<p>Request ID: ${selectedRequestId}</p>
					<p>Ready to generate proof!</p>
				</div>
			` : `
				<div class="approved-requests">
					<h4>Select an Approved Request:</h4>
					${approvedRequests.map(req => `
						<div class="request-selector">
							<div>
								<strong>${req.fullName}</strong> - ${req.passportNumber}
								<br><small>${new Date(req.createdAt || '').toLocaleString()}</small>
							</div>
							<button class="btn btn-sm btn-primary" onclick="window.loadSignatureForProof('${req.id}')">
								Load Signature
							</button>
						</div>
					`).join('')}
				</div>
			`}
			
			${selectedRequestId ? `
				<button id="generateProof" class="btn btn-primary">🔐 Generate zkSNARK Proof</button>
				<div id="proofOutput" class="info-box"></div>
			` : ''}
		</div>
		
		${currentProof ? `
			<div class="section">
				<h2>✅ Verify Proof (Local)</h2>
				<button id="verifyProof" class="btn btn-primary">Verify Proof Locally</button>
				<div id="localVerifyOutput"></div>
			</div>
			
			<div class="section">
				<h2>⛓️ Verify Proof (On-Chain)</h2>
				<p>Submit your proof to the blockchain for final verification.</p>
				<button id="verifyOnChain" class="btn btn-success">Verify Proof On-Chain</button>
				<p class="note">Contract: <a href="${getExplorerLink(getVerifierContractAddress())}" target="_blank">${getVerifierContractAddress()}</a></p>
				<div id="onchainVerifyOutput"></div>
			</div>
		` : ''}
	`;
}

function attachEventListeners() {
	// Tab switching
	document.querySelectorAll('.tab').forEach(tab => {
		tab.addEventListener('click', (e) => {
			const tabName = (e.target as HTMLElement).getAttribute('data-tab');
			switchTab(tabName!);
		});
	});
	
	// Generate credentials
	const generateCredBtn = document.querySelector('#generateCred');
	if (generateCredBtn) {
		generateCredBtn.addEventListener('click', handleGenerateCredentials);
	}
	
	// Registration form
	const registrationForm = document.querySelector('#registrationForm');
	if (registrationForm) {
		registrationForm.addEventListener('submit', handleRegistrationSubmit);
	}
	
	// Proof generation
	const generateProofBtn = document.querySelector('#generateProof');
	if (generateProofBtn) {
		generateProofBtn.addEventListener('click', handleGenerateProof);
	}
	
	// Verify proof
	const verifyProofBtn = document.querySelector('#verifyProof');
	if (verifyProofBtn) {
		verifyProofBtn.addEventListener('click', handleVerifyProof);
	}
	
	// Verify on-chain
	const verifyOnChainBtn = document.querySelector('#verifyOnChain');
	if (verifyOnChainBtn) {
		verifyOnChainBtn.addEventListener('click', handleVerifyOnChain);
	}
	
	// Logout button
	const logoutBtn = document.querySelector('#logoutBtn');
	if (logoutBtn) {
		logoutBtn.addEventListener('click', handleLogout);
	}
}

function switchTab(tabName: string) {
	// Update tab buttons
	document.querySelectorAll('.tab').forEach(tab => {
		tab.classList.remove('active');
		if (tab.getAttribute('data-tab') === tabName) {
			tab.classList.add('active');
		}
	});
	
	// Update tab content
	document.querySelectorAll('.tab-pane').forEach(pane => {
		pane.classList.remove('active');
	});
	const activePane = document.querySelector(`#tab-${tabName}`);
	if (activePane) {
		activePane.classList.add('active');
	}
	
	// Re-render content if needed
	if (tabName === 'credentials') {
		const credTab = document.querySelector('#tab-credentials');
		if (credTab) {
			credTab.innerHTML = renderCredentialsTab();
		}
	} else if (tabName === 'proof') {
		const proofTab = document.querySelector('#tab-proof');
		if (proofTab) {
			proofTab.innerHTML = renderProofTab();
			attachEventListeners();
		}
	}
}

// Global window functions for onclick handlers
(window as any).selectCredential = function(credId: string) {
	selectedCredentialId = credId;
	log(`Selected credential: ${credentialsList.find(c => c.id === credId)?.name}`, 'success');
	
	// Re-render credentials tab
	const credTab = document.querySelector('#tab-credentials');
	if (credTab) {
		credTab.innerHTML = renderCredentialsTab();
	}
	
	// Switch to proof tab
	switchTab('proof');
};

(window as any).viewCredentialDetails = function(credId: string) {
	const cred = credentialsList.find(c => c.id === credId);
	if (!cred) return;
	
	const detailsHtml = `
		<div class="modal-overlay" onclick="this.remove()">
			<div class="modal" onclick="event.stopPropagation()">
				<div class="modal-header">
					<h2>📋 Credential Details: ${cred.name}</h2>
					<button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
				</div>
				<div class="modal-body">
					<div class="detail-group">
						<label>Voter ID:</label>
						<div class="value-wrap">${cred.credentials.ID.toString()}</div>
					</div>
					<div class="detail-group">
						<label>Secret X:</label>
						<div class="value-wrap">${cred.credentials.X.toString()}</div>
					</div>
					<div class="detail-group">
						<label>Secret Xp:</label>
						<div class="value-wrap">${cred.credentials.Xp.toString()}</div>
					</div>
					<div class="detail-group">
						<label>Created:</label>
						<div>${new Date(cred.createdAt).toLocaleString()}</div>
					</div>
					<div class="detail-group">
						<label>Total Requests:</label>
						<div>${cred.requests.length}</div>
					</div>
				</div>
			</div>
		</div>
	`;
	document.body.insertAdjacentHTML('beforeend', detailsHtml);
};

(window as any).downloadCredential = function(credId: string) {
	const cred = credentialsList.find(c => c.id === credId);
	if (!cred) return;
	
	// Convert BigInt to string for JSON
	const credData = {
		...cred,
		credentials: {
			ID: cred.credentials.ID.toString(),
			X: cred.credentials.X.toString(),
			Xp: cred.credentials.Xp.toString(),
		}
	};
	
	const data = JSON.stringify(credData, null, 2);
	const blob = new Blob([data], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `credential-${cred.name.replace(/\s+/g, '-')}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	log(`Downloaded credential: ${cred.name}`, 'success');
};

(window as any).deleteCredential = async function(credId: string) {
	const cred = credentialsList.find(c => c.id === credId);
	if (!cred) {
		log('Credential not found!', 'error');
		return;
	}
	
	const hasApproved = cred.requests.some(r => r.status === 'approved');
	if (hasApproved) {
		log('Cannot delete credential with approved requests!', 'error');
		return;
	}
	
	if (!confirm(`Delete credential "${cred.name}"?\n\nThis will permanently remove this credential and all its pending requests. This action cannot be undone.`)) {
		return;
	}
	
	try {
		// Delete all pending requests from backend
		for (const req of cred.requests) {
			if (req.status === 'pending' || req.status === 'rejected' || req.status === 'auto_rejected') {
				try {
					// Note: Backend doesn't have a delete endpoint, but we'll remove it locally
					console.log(`Would delete request ${req.id} from backend`);
				} catch (error) {
					console.warn(`Failed to delete request ${req.id}:`, error);
				}
			}
		}
		
		// Remove credential locally
		credentialsList = credentialsList.filter(c => c.id !== credId);
		if (selectedCredentialId === credId) {
			selectedCredentialId = null;
		}
		saveCredentials();
		log(`Deleted credential: ${cred.name}`, 'success');
		
		// Re-render credentials tab
		const credTab = document.querySelector('#tab-credentials');
		if (credTab) {
			credTab.innerHTML = renderCredentialsTab();
		}
	} catch (error) {
		log(`Error deleting credential: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	}
};

(window as any).submitNewRequestForCredential = function(credId: string) {
	const cred = credentialsList.find(c => c.id === credId);
	if (!cred) return;
	
	// Store credential as temp for form submission
	(window as any).tempCredential = cred;
	
	// Switch to register tab and show registration form
	switchTab('register');
	
	// Hide credential generation section, show registration form
	setTimeout(() => {
		const regSection = document.querySelector('#registrationSection') as HTMLElement;
		if (regSection) {
			regSection.style.display = 'block';
		}
		
		const credentialsDiv = document.querySelector('#newCredentials');
		if (credentialsDiv) {
			credentialsDiv.innerHTML = `
				<h3>📋 Using Credential: ${cred.name}</h3>
				<div class="credential-item">
					<strong>Voter ID:</strong>
					<div class="value-short" title="${cred.credentials.ID.toString()}">${String(cred.credentials.ID).substring(0, 20)}...</div>
				</div>
				<p class="note">Fill out the form below to submit a new registration request for this credential.</p>
			`;
		}
	}, 100);
};

(window as any).loadSignatureForProof = async function(requestId: string) {
	try {
		log(`Loading signature for request ${requestId}...`);
		
		// Find which credential this request belongs to
		const cred = credentialsList.find(c => c.requests.some(r => r.id === requestId));
		if (!cred) {
			log('Credential not found for this request!', 'error');
			return;
		}
		
		// Select this credential
		selectedCredentialId = cred.id;
		selectedRequestId = requestId;
		
		log('Signature loaded successfully!', 'success');
		
		// Switch to proof tab
		switchTab('proof');
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	}
};

async function handleGenerateCredentials() {
	try {
		const nameInput = document.querySelector('#credentialName') as HTMLInputElement;
		const name = nameInput?.value.trim() || `Credential ${credentialsList.length + 1}`;
		
		log('Generating random voter credentials...');
		const btn = document.querySelector('#generateCred') as HTMLButtonElement;
		btn.disabled = true;

		// Generate random credentials
		const credentials: VoteCredentials = {
			ID: generateRandomField(),
			X: generateRandomField(),
			Xp: generateRandomField(),
		};

		// Create credential item
		const newCredential: CredentialItem = {
			id: Date.now().toString() + Math.random().toString(36).substring(7),
			credentials,
			createdAt: Date.now(),
			name,
			requests: [],
		};
		
		credentialsList.push(newCredential);
		saveCredentials();

		// Display credentials
		const credentialsDiv = document.querySelector('#newCredentials');
		if (credentialsDiv) {
			credentialsDiv.innerHTML = `
				<h3>✅ Credentials Generated: ${name}</h3>
				<div class="credential-item">
					<strong>Voter ID:</strong>
					<div class="value-short" title="${credentials.ID.toString()}">${String(credentials.ID).substring(0, 20)}...</div>
				</div>
				<p class="note">✓ Credentials saved! Now you can submit a registration request.</p>
			`;
		}

		log('Credentials generated and saved successfully!', 'success');
		
		// Show registration section
		const regSection = document.querySelector('#registrationSection') as HTMLElement;
		if (regSection) {
			regSection.style.display = 'block';
		}
		
		// Store temporarily for form submission
		(window as any).tempCredential = newCredential;
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	} finally {
		const btn = document.querySelector('#generateCred') as HTMLButtonElement;
		if (btn) btn.disabled = false;
	}
}

async function handleRegistrationSubmit(e: Event) {
	e.preventDefault();
	
	const tempCred = (window as any).tempCredential as CredentialItem;
	if (!tempCred) {
		log('Please generate credentials first!', 'error');
		return;
	}
	
	try {
		log('Submitting registration...');
		const submitBtn = document.querySelector('#submitRegistration') as HTMLButtonElement;
		submitBtn.disabled = true;
		
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		
		// Add credentials to form data (send hash of Xp, not plain Xp)
		const hashXp = poseidon1([tempCred.credentials.Xp]);
		formData.append('voterId', tempCred.credentials.ID.toString());
		formData.append('secretX', tempCred.credentials.X.toString());
		formData.append('hashXp', hashXp.toString());
		
		const response = await voterAPI.submitRegistration(formData);
		
		// Find the credential in the list and add request to it
		const credInList = credentialsList.find(c => c.id === tempCred.id);
		if (credInList) {
			credInList.requests.push(response);
			saveCredentials();
		}
		
		log(`Registration submitted successfully! Request ID: ${response.id}`, 'success');
		log('Go to "My Credentials" tab to check your requests.', 'info');
		
		// Reset form
		form.reset();
		const nameInput = document.querySelector('#credentialName') as HTMLInputElement;
		if (nameInput) nameInput.value = '';
		
		const regSection = document.querySelector('#registrationSection') as HTMLElement;
		if (regSection) regSection.style.display = 'none';
		
		const credentialsDiv = document.querySelector('#newCredentials');
		if (credentialsDiv) credentialsDiv.innerHTML = '';
		
		// Clear temp
		delete (window as any).tempCredential;
		
		// Switch to credentials tab
		switchTab('credentials');
		
		// Start periodic refresh for this request
		startRequestRefresh(tempCred.id, response.id);
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	} finally {
		const submitBtn = document.querySelector('#submitRegistration') as HTMLButtonElement;
		if (submitBtn) submitBtn.disabled = false;
	}
}

// Refresh request status periodically
function startRequestRefresh(credId: string, requestId: string) {
	const interval = setInterval(async () => {
		try {
			const cred = credentialsList.find(c => c.id === credId);
			if (!cred) {
				clearInterval(interval);
				return;
			}
			
			const reqIndex = cred.requests.findIndex(r => r.id === requestId);
			if (reqIndex === -1) {
				clearInterval(interval);
				return;
			}
			
			const updated = await voterAPI.getRequest(requestId);
			cred.requests[reqIndex] = updated;
			saveCredentials();
			
			// Stop refreshing if not pending anymore
			if (updated.status !== 'pending') {
				clearInterval(interval);
				
				// Re-render if on credentials tab
				const credTab = document.querySelector('#tab-credentials');
				if (credTab && credTab.classList.contains('active')) {
					credTab.innerHTML = renderCredentialsTab();
				}
				
				// Show notification
				if (updated.status === 'approved') {
					log(`✅ Request approved for ${cred.name}!`, 'success');
				} else if (updated.status === 'rejected' || updated.status === 'auto_rejected') {
					log(`❌ Request ${updated.status === 'auto_rejected' ? 'auto-rejected' : 'rejected'} for ${cred.name}`, 'error');
				}
			}
		} catch (error) {
			console.error('Failed to refresh request:', error);
		}
	}, 10000); // Check every 10 seconds
}

// Refresh all pending requests periodically
function startGlobalRefresh() {
	setInterval(async () => {
		for (const cred of credentialsList) {
			for (let i = 0; i < cred.requests.length; i++) {
				const req = cred.requests[i];
				if (req.status === 'pending') {
					try {
						const updated = await voterAPI.getRequest(req.id);
						cred.requests[i] = updated;
						
						// If status changed, update UI
						if (updated.status !== 'pending') {
							saveCredentials();
							const credTab = document.querySelector('#tab-credentials');
							if (credTab && credTab.classList.contains('active')) {
								credTab.innerHTML = renderCredentialsTab();
							}
							
							if (updated.status === 'approved') {
								log(`✅ Request approved for ${cred.name}!`, 'success');
							}
						}
					} catch (error) {
						console.error('Failed to refresh request:', error);
					}
				}
			}
		}
	}, 15000); // Check every 15 seconds
}

async function handleGenerateProof() {
	const selectedCred = getSelectedCredential();
	if (!selectedCred || !selectedRequestId) {
		log('Please select a credential and load signature first!', 'error');
		return;
	}
	
	const request = selectedCred.requests.find(r => r.id === selectedRequestId);
	if (!request || request.status !== 'approved') {
		log('Selected request is not approved!', 'error');
		return;
	}
	
	try {
		log('Loading signature data...');
		const btn = document.querySelector('#generateProof') as HTMLButtonElement;
		btn.disabled = true;
		
		// Load signature from backend
		const signature = await voterAPI.getSignature(selectedRequestId);
		
		log('Preparing circuit input...');
		
		// Get admin public key from backend
		const adminPubKey = await voterAPI.getAdminPublicKey();
		
		// Convert signature from backend to required format
		const R8x = BigInt(signature.signatureR8x);
		const R8y = BigInt(signature.signatureR8y);
		const S = BigInt(signature.signatureS);
		const Ax = BigInt(adminPubKey.publicKeyX);
		const Ay = BigInt(adminPubKey.publicKeyY);
		
		// Generate circuit input
		const electionId = 12345n; // Demo election ID
		const input = await generateVoteInput(
			selectedCred.credentials,
			electionId,
			{ R8x, R8y, S, Ax, Ay }
		);
		
		log('Generating zkSNARK proof (this may take 10-30 seconds)...');
		
		const { proof, publicSignals } = await generateProof(
			input,
			WASM_PATH,
			ZKEY_PATH,
			(msg) => log(msg, 'info')
		);
		
		currentProof = proof;
		currentPublicSignals = publicSignals;
		
		// Display proof
		const proofOutputDiv = document.querySelector('#proofOutput');
		if (proofOutputDiv) {
			const parsed = parsePublicSignals(publicSignals);
			proofOutputDiv.innerHTML = `
				<h3>✅ Proof Generated Successfully!</h3>
				<div class="credential-item">
					<strong>Nullifier Hash:</strong>
					<div class="value">${parsed.nullifier}</div>
				</div>
				<div class="credential-item">
					<strong>Election ID:</strong>
					<div class="value">${parsed.electionId}</div>
				</div>
				<p class="note">Proof contains ${publicSignals.length} public signals</p>
				<button id="downloadProof" class="btn btn-secondary">📥 Download Proof</button>
			`;
			
			// Attach download handler
			const downloadBtn = document.querySelector('#downloadProof');
			if (downloadBtn) {
				downloadBtn.addEventListener('click', () => {
					const proofJson = exportProof(proof, publicSignals);
					const blob = new Blob([proofJson], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = 'proof.json';
					a.click();
					URL.revokeObjectURL(url);
					log('Proof downloaded!', 'success');
				});
			}
		}
		
		log('Proof generated successfully!', 'success');
		
		// Re-render proof tab to show verify buttons
		const proofTab = document.querySelector('#tab-proof');
		if (proofTab) {
			proofTab.innerHTML = renderProofTab();
			attachEventListeners();
		}
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	} finally {
		const btn = document.querySelector('#generateProof') as HTMLButtonElement;
		if (btn) btn.disabled = false;
	}
}

async function handleVerifyProof() {
	if (!currentProof || !currentPublicSignals) {
		log('Please generate a proof first!', 'error');
		return;
	}
	
	try {
		log('Verifying proof locally...');
		const btn = document.querySelector('#verifyProof') as HTMLButtonElement;
		btn.disabled = true;
		
		const isValid = await verifyProof(
			currentProof,
			currentPublicSignals,
			VKEY_PATH,
			(msg) => log(msg, 'info')
		);
		
		const outputDiv = document.querySelector('#localVerifyOutput');
		if (outputDiv) {
			if (isValid) {
				outputDiv.innerHTML = `<div class="success-box">✅ Proof verified successfully (local)!</div>`;
			} else {
				outputDiv.innerHTML = `<div class="error-box">❌ Proof verification failed!</div>`;
			}
		}
		
		if (isValid) {
			log('✅ Proof verified successfully (local)!', 'success');
		} else {
			log('❌ Proof verification failed!', 'error');
		}
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	} finally {
		const btn = document.querySelector('#verifyProof') as HTMLButtonElement;
		if (btn) btn.disabled = false;
	}
}

async function handleVerifyOnChain() {
	if (!currentProof || !currentPublicSignals) {
		log('Please generate and verify a proof first!', 'error');
		return;
	}
	
	if (!isMetaMaskInstalled()) {
		log('❌ MetaMask is not installed! Please install MetaMask to verify on-chain.', 'error');
		window.open('https://metamask.io/', '_blank');
		return;
	}
	
	try {
		log('Preparing on-chain verification...');
		const btn = document.querySelector('#verifyOnChain') as HTMLButtonElement;
		btn.disabled = true;
		
		const result = await verifyProofOnChain(
			currentProof,
			currentPublicSignals,
			(msg) => log(msg, 'info')
		);
		
		const outputDiv = document.querySelector('#onchainVerifyOutput');
		if (outputDiv) {
			if (result.success) {
				outputDiv.innerHTML = `
					<div class="success-box">
						✅ Proof verified successfully on-chain!
						<br><small>TX: <a href="${getExplorerLink(result.txHash!)}" target="_blank">${result.txHash}</a></small>
					</div>
				`;
			} else {
				outputDiv.innerHTML = `<div class="error-box">❌ On-chain verification failed: ${result.error}</div>`;
			}
		}
		
		if (result.success) {
			log('✅ Proof verified successfully on-chain!', 'success');
			log(`Transaction hash: ${result.txHash}`, 'info');
		} else {
			log(`❌ On-chain verification failed: ${result.error}`, 'error');
		}
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	} finally {
		const btn = document.querySelector('#verifyOnChain') as HTMLButtonElement;
		if (btn) btn.disabled = false;
	}
}

// Initialize app on load
if (!authService.isAuthenticated()) {
	renderAuthPage();
} else {
	initApp();
}

async function handleLogout() {
	try {
		await authService.logout();
		renderAuthPage();
	} catch (error) {
		console.error('Logout error:', error);
		// Clear tokens anyway
		authService.clearTokens();
		renderAuthPage();
	}
}

// Auth pages
function renderAuthPage() {
	app.innerHTML = `
		<div class="auth-container">
			<div class="auth-box">
				<header class="auth-header">
					<h1>🗳️ Voter Portal</h1>
					<p>Secure Zero-Knowledge Proof Voting System</p>
				</header>
				
				<div class="auth-tabs">
					<button class="auth-tab active" data-auth-tab="login">Login</button>
					<button class="auth-tab" data-auth-tab="register">Sign Up</button>
				</div>
				
				<div class="auth-content">
					<div id="auth-login" class="auth-pane active">
						${renderLoginForm()}
					</div>
					<div id="auth-register" class="auth-pane">
						${renderRegisterForm()}
					</div>
				</div>
			</div>
		</div>
	`;
	
	attachAuthListeners();
}

function renderLoginForm() {
	return `
		<form id="loginForm" class="auth-form">
			<div class="form-group">
				<label for="loginEmail">Email</label>
				<input type="email" id="loginEmail" required placeholder="you@example.com" autocomplete="email" />
			</div>
			<div class="form-group">
				<label for="loginPassword">Password</label>
				<input type="password" id="loginPassword" required placeholder="••••••••" autocomplete="current-password" />
			</div>
			<button type="submit" class="btn btn-primary btn-block">Login</button>
			<div id="loginError" class="error-message"></div>
		</form>
	`;
}

function renderRegisterForm() {
	return `
		<form id="registerForm" class="auth-form">
			<div class="form-group">
				<label for="registerEmail">Email</label>
				<input type="email" id="registerEmail" required placeholder="you@example.com" autocomplete="email" />
			</div>
			<div class="form-group">
				<label for="registerPassword">Password</label>
				<input type="password" id="registerPassword" required placeholder="••••••••" minlength="6" autocomplete="new-password" />
				<small>Minimum 6 characters</small>
			</div>
			<div class="form-group">
				<label for="registerConfirmPassword">Confirm Password</label>
				<input type="password" id="registerConfirmPassword" required placeholder="••••••••" minlength="6" autocomplete="new-password" />
			</div>
			<button type="submit" class="btn btn-primary btn-block">Create Account</button>
			<div id="registerError" class="error-message"></div>
		</form>
	`;
}

function attachAuthListeners() {
	// Tab switching
	const authTabs = document.querySelectorAll('.auth-tab');
	authTabs.forEach(tab => {
		tab.addEventListener('click', () => {
			const tabName = tab.getAttribute('data-auth-tab');
			authTabs.forEach(t => t.classList.remove('active'));
			tab.classList.add('active');
			
			document.querySelectorAll('.auth-pane').forEach(pane => pane.classList.remove('active'));
			document.getElementById(`auth-${tabName}`)?.classList.add('active');
		});
	});
	
	// Login form
	const loginForm = document.getElementById('loginForm') as HTMLFormElement;
	loginForm?.addEventListener('submit', handleLogin);
	
	// Register form
	const registerForm = document.getElementById('registerForm') as HTMLFormElement;
	registerForm?.addEventListener('submit', handleRegister);
}

async function handleLogin(e: Event) {
	e.preventDefault();
	const form = e.target as HTMLFormElement;
	const email = (form.querySelector('#loginEmail') as HTMLInputElement).value;
	const password = (form.querySelector('#loginPassword') as HTMLInputElement).value;
	const errorDiv = form.querySelector('#loginError') as HTMLDivElement;
	const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
	
	errorDiv.textContent = '';
	submitBtn.disabled = true;
	submitBtn.textContent = 'Logging in...';
	
	try {
		await authService.login(email, password);
		// Redirect to main app
		initApp();
	} catch (error: any) {
		errorDiv.textContent = error.response?.data?.message || 'Invalid email or password';
		submitBtn.disabled = false;
		submitBtn.textContent = 'Login';
	}
}

async function handleRegister(e: Event) {
	e.preventDefault();
	const form = e.target as HTMLFormElement;
	const email = (form.querySelector('#registerEmail') as HTMLInputElement).value;
	const password = (form.querySelector('#registerPassword') as HTMLInputElement).value;
	const confirmPassword = (form.querySelector('#registerConfirmPassword') as HTMLInputElement).value;
	const errorDiv = form.querySelector('#registerError') as HTMLDivElement;
	const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
	
	errorDiv.textContent = '';
	
	if (password !== confirmPassword) {
		errorDiv.textContent = 'Passwords do not match';
		return;
	}
	
	if (password.length < 6) {
		errorDiv.textContent = 'Password must be at least 6 characters';
		return;
	}
	
	submitBtn.disabled = true;
	submitBtn.textContent = 'Creating account...';
	
	try {
		await authService.register(email, password);
		// Redirect to main app
		initApp();
	} catch (error: any) {
		errorDiv.textContent = error.response?.data?.message || 'Registration failed. Email may already be in use.';
		submitBtn.disabled = false;
		submitBtn.textContent = 'Create Account';
	}
}
