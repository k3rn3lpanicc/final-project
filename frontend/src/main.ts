import './style.css';
import {
	generateRandomField,
	generateVoteInput,
	type VoteCredentials,
} from './zkUtils';
import { generateProof, verifyProof, parsePublicSignals, exportProof } from './proofGenerator';
import { verifyProofOnChain, isMetaMaskInstalled, getVerifierContractAddress, getExplorerLink } from './blockchainVerifier';
import { voterAPI, type VoterRequest, type SignatureData } from './api';
import { authService } from './auth';
import { poseidon1 } from 'poseidon-lite';

// Circuit file paths
const WASM_PATH = '/circuit/VoteScheme.wasm';
const ZKEY_PATH = '/circuit/VoteScheme_final.zkey';
const VKEY_PATH = '/circuit/verification_key.json';

let currentCredentials: VoteCredentials | null = null;
let currentRequestId: string | null = null;
let currentSignature: SignatureData | null = null;
let currentProof: any = null;
let currentPublicSignals: string[] = [];
let myRequests: VoterRequest[] = [];

// DOM Elements
const app = document.querySelector<HTMLDivElement>('#app')!;

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
				<button class="tab active" data-tab="register">Register</button>
				<button class="tab" data-tab="requests">My Requests</button>
				<button class="tab" data-tab="proof">Generate Proof</button>
			</nav>
			
			<div class="tab-content">
				<div id="tab-register" class="tab-pane active">
					${renderRegisterTab()}
				</div>
				<div id="tab-requests" class="tab-pane">
					${renderRequestsTab()}
				</div>
				<div id="tab-proof" class="tab-pane">
					${renderProofTab()}
				</div>
			</div>
			
			<div id="log" class="log"></div>
		</div>
	`;
	
	attachEventListeners();
	loadMyRequests();
}

function renderRegisterTab() {
	return `
		<div class="section">
			<h2>Step 1: Generate Credentials</h2>
			<p>First, generate your unique voter credentials. These will be used to create your anonymous voting identity.</p>
			<button id="generateCred" class="btn btn-primary">Generate Voter Credentials</button>
			<div id="credentials" class="info-box"></div>
		</div>
		
		<div class="section">
			<h2>Step 2: Submit Registration</h2>
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
				<button type="submit" id="submitRegistration" class="btn btn-primary" disabled>Submit Registration</button>
			</form>
		</div>
	`;
}

function renderRequestsTab() {
	if (myRequests.length === 0) {
		return `
			<div class="empty-state">
				<p>You haven't submitted any requests yet.</p>
				<p>Go to the Register tab to submit your first request.</p>
			</div>
		`;
	}
	
	return `
		<div class="section">
			<div class="header-actions">
				<h2>My Registration Requests</h2>
				<button id="refreshRequests" class="btn btn-secondary">🔄 Refresh</button>
			</div>
			<div class="requests-list">
				${myRequests.map(req => renderRequestCard(req)).join('')}
			</div>
		</div>
	`;
}

function renderRequestCard(request: VoterRequest) {
	const statusClass = request.status === 'approved' ? 'status-approved' :
	                    (request.status === 'rejected' || request.status === 'auto_rejected') ? 'status-rejected' : 'status-pending';
	
	return `
		<div class="request-card">
			<div class="request-header">
				<span class="request-id">ID: ${request.id.substring(0, 8)}...</span>
				<span class="status-badge ${statusClass}">${request.status === 'auto_rejected' ? 'AUTO REJECTED' : request.status.toUpperCase()}</span>
			</div>
			<div class="request-body">
				<p><strong>Name:</strong> ${request.fullName}</p>
				<p><strong>Passport:</strong> ${request.passportNumber}</p>
				<p><strong>Status:</strong> ${request.status === 'auto_rejected' ? 'Auto Rejected' : request.status}</p>
				<p><strong>Submitted:</strong> ${new Date(request.createdAt || '').toLocaleString()}</p>
			</div>
			<div class="request-actions">
				${request.status === 'approved' ? `
					<button class="btn btn-primary" onclick="window.loadSignature('${request.id}')">
						View Signature & Generate Proof
					</button>
				` : request.status === 'pending' ? `
					<p class="pending-message">⏳ Waiting for admin approval...</p>
				` : request.status === 'auto_rejected' ? `
					<p class="rejected-message">🔄 Auto-rejected (another request was approved)</p>
				` : `
					<p class="rejected-message">❌ Request rejected</p>
				`}
			</div>
		</div>
	`;
}

function renderProofTab() {
	if (!currentSignature) {
		return `
			<div class="empty-state">
				<p>No signature loaded.</p>
				<p>Please go to "My Requests" and select an approved request to load signature data.</p>
			</div>
		`;
	}
	
	return `
		<div class="section">
			<h2>Step 3: Generate Zero-Knowledge Proof</h2>
			<div class="info-box">
				<h4>Signature Data Loaded</h4>
				<p>Request ID: ${currentRequestId}</p>
				<p class="note">Your credentials have been signed by the admin. You can now generate a proof.</p>
			</div>
			<button id="generateProof" class="btn btn-primary">Generate zkSNARK Proof</button>
			<div id="proofOutput" class="info-box"></div>
		</div>
		
		<div class="section">
			<h2>Step 4: Verify Proof (Local)</h2>
			<button id="verifyProof" class="btn btn-primary" disabled>Verify Proof Locally</button>
		</div>
		
		<div class="section">
			<h2>Step 5: Verify Proof (On-Chain)</h2>
			<p>Submit your proof to the blockchain for final verification.</p>
			<button id="verifyOnChain" class="btn btn-success" disabled>Verify Proof On-Chain</button>
			<p class="note">Contract Address: <a href="${getExplorerLink(getVerifierContractAddress())}" target="_blank">${getVerifierContractAddress()}</a></p>
		</div>
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
	
	// Refresh requests
	const refreshBtn = document.querySelector('#refreshRequests');
	if (refreshBtn) {
		refreshBtn.addEventListener('click', loadMyRequests);
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
	if (tabName === 'requests') {
		const requestsTab = document.querySelector('#tab-requests');
		if (requestsTab) {
			requestsTab.innerHTML = renderRequestsTab();
			// Attach refresh button listener
			const refreshBtn = document.querySelector('#refreshRequests');
			if (refreshBtn) {
				refreshBtn.addEventListener('click', loadMyRequests);
			}
		}
	} else if (tabName === 'proof') {
		const proofTab = document.querySelector('#tab-proof');
		if (proofTab) {
			proofTab.innerHTML = renderProofTab();
			attachEventListeners();
		}
	}
}

async function handleGenerateCredentials() {
	try {
		log('Generating random voter credentials...');
		const btn = document.querySelector('#generateCred') as HTMLButtonElement;
		btn.disabled = true;

		// Generate random credentials
		const credentials: VoteCredentials = {
			ID: generateRandomField(),
			X: generateRandomField(),
			Xp: generateRandomField(),
		};

		currentCredentials = credentials;

		// Display credentials
		const credentialsDiv = document.querySelector('#credentials');
		if (credentialsDiv) {
			credentialsDiv.innerHTML = `
				<h3>✅ Voter Credentials Generated</h3>
				<div class="credential-item">
					<strong>Voter ID:</strong>
					<div class="value">${credentials.ID.toString()}</div>
				</div>
				<div class="credential-item">
					<strong>Secret X:</strong>
					<div class="value">${credentials.X.toString()}</div>
				</div>
				<div class="credential-item">
					<strong>Secret Xp:</strong>
					<div class="value">${credentials.Xp.toString()}</div>
				</div>
				<p class="note">⚠️ Save these credentials securely! You'll need them to generate proofs.</p>
			`;
		}

		log('Credentials generated successfully!', 'success');
		
		// Enable registration form
		const submitBtn = document.querySelector('#submitRegistration') as HTMLButtonElement;
		if (submitBtn) {
			submitBtn.disabled = false;
		}
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	} finally {
		const btn = document.querySelector('#generateCred') as HTMLButtonElement;
		if (btn) btn.disabled = false;
	}
}

async function handleRegistrationSubmit(e: Event) {
	e.preventDefault();
	
	if (!currentCredentials) {
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
		const hashXp = poseidon1([currentCredentials.Xp]);
		formData.append('voterId', currentCredentials.ID.toString());
		formData.append('secretX', currentCredentials.X.toString());
		formData.append('hashXp', hashXp.toString());
		
		const response = await voterAPI.submitRegistration(formData);
		
		currentRequestId = response.id;
		myRequests.unshift(response);
		
		// Store in localStorage
		localStorage.setItem('myRequests', JSON.stringify(myRequests));
		localStorage.setItem(`credentials_${response.id}`, JSON.stringify(currentCredentials));
		
		log(`Registration submitted successfully! Request ID: ${response.id}`, 'success');
		log('Go to "My Requests" tab to check your status.', 'info');
		
		// Reset form and credentials
		form.reset();
		submitBtn.disabled = true;
		
		// Switch to requests tab
		switchTab('requests');
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	} finally {
		const submitBtn = document.querySelector('#submitRegistration') as HTMLButtonElement;
		if (submitBtn) submitBtn.disabled = false;
	}
}

function loadMyRequests() {
	// Load from localStorage
	const stored = localStorage.getItem('myRequests');
	if (stored) {
		myRequests = JSON.parse(stored);
		
		// Refresh each request status
		myRequests.forEach(async (req, index) => {
			try {
				const updated = await voterAPI.getRequest(req.id);
				myRequests[index] = updated;
				localStorage.setItem('myRequests', JSON.stringify(myRequests));
				
				// Re-render if on requests tab
				const requestsTab = document.querySelector('#tab-requests');
				if (requestsTab && requestsTab.classList.contains('active')) {
					requestsTab.innerHTML = renderRequestsTab();
					// Re-attach refresh button listener
					const refreshBtn = document.querySelector('#refreshRequests');
					if (refreshBtn) {
						refreshBtn.addEventListener('click', loadMyRequests);
					}
				}
			} catch (error) {
				console.error(`Failed to refresh request ${req.id}:`, error);
			}
		});
	}
	
	// Re-render requests tab
	const requestsTab = document.querySelector('#tab-requests');
	if (requestsTab) {
		requestsTab.innerHTML = renderRequestsTab();
		// Re-attach refresh button listener
		const refreshBtn = document.querySelector('#refreshRequests');
		if (refreshBtn) {
			refreshBtn.addEventListener('click', loadMyRequests);
		}
	}
}

(window as any).loadSignature = async function(requestId: string) {
	try {
		log(`Loading signature for request ${requestId}...`);
		
		// Load signature from backend
		const signature = await voterAPI.getSignature(requestId);
		currentSignature = signature;
		currentRequestId = requestId;
		
		// Load credentials from localStorage
		const storedCred = localStorage.getItem(`credentials_${requestId}`);
		if (storedCred) {
			currentCredentials = JSON.parse(storedCred);
		}
		
		log('Signature loaded successfully!', 'success');
		
		// Switch to proof tab
		switchTab('proof');
	} catch (error) {
		log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
	}
};

async function handleGenerateProof() {
	if (!currentCredentials || !currentSignature) {
		log('Please load signature data first!', 'error');
		return;
	}
	
	try {
		log('Preparing circuit input...');
		const btn = document.querySelector('#generateProof') as HTMLButtonElement;
		btn.disabled = true;
		
		// Get admin public key from backend
		const adminPubKey = await voterAPI.getAdminPublicKey();
		
		// Convert signature from backend to required format
		const R8x = BigInt(currentSignature.signatureR8x);
		const R8y = BigInt(currentSignature.signatureR8y);
		const S = BigInt(currentSignature.signatureS);
		const Ax = BigInt(adminPubKey.publicKeyX);
		const Ay = BigInt(adminPubKey.publicKeyY);
		
		// Generate circuit input
		const electionId = 12345n; // Demo election ID
		const input = await generateVoteInput(
			currentCredentials,
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
		
		// Enable verify buttons
		const verifyProofBtn = document.querySelector('#verifyProof') as HTMLButtonElement;
		if (verifyProofBtn) verifyProofBtn.disabled = false;
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
		
		if (isValid) {
			log('✅ Proof verified successfully (local)!', 'success');
			
			// Enable on-chain verification
			const verifyOnChainBtn = document.querySelector('#verifyOnChain') as HTMLButtonElement;
			if (verifyOnChainBtn) verifyOnChainBtn.disabled = false;
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
