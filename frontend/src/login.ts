import './style.css';
import { authService } from './auth';

const app = document.querySelector<HTMLDivElement>('#app')!;

function renderLoginPage() {
	app.innerHTML = `
		<div class="container auth-container">
			<header>
				<h1>🗳️ zkSNARK Voting System</h1>
				<p>Secure, Anonymous, Verifiable</p>
			</header>
			
			<div class="auth-box">
				<div class="auth-tabs">
					<button class="auth-tab active" data-tab="login">Login</button>
					<button class="auth-tab" data-tab="register">Register</button>
				</div>
				
				<div class="auth-content">
					<div id="loginForm" class="auth-form active">
						<h2>Welcome Back</h2>
						<form id="loginFormElement">
							<div class="form-group">
								<label for="loginEmail">Email:</label>
								<input type="email" id="loginEmail" name="email" required autocomplete="email" />
							</div>
							<div class="form-group">
								<label for="loginPassword">Password:</label>
								<input type="password" id="loginPassword" name="password" required autocomplete="current-password" />
							</div>
							<button type="submit" class="btn btn-primary btn-block">Login</button>
						</form>
						<div id="loginError" class="error-message" style="display: none;"></div>
					</div>
					
					<div id="registerForm" class="auth-form">
						<h2>Create Account</h2>
						<form id="registerFormElement">
							<div class="form-group">
								<label for="registerEmail">Email:</label>
								<input type="email" id="registerEmail" name="email" required autocomplete="email" />
							</div>
							<div class="form-group">
								<label for="registerPassword">Password:</label>
								<input type="password" id="registerPassword" name="password" required autocomplete="new-password" minlength="6" />
							</div>
							<div class="form-group">
								<label for="confirmPassword">Confirm Password:</label>
								<input type="password" id="confirmPassword" name="confirmPassword" required autocomplete="new-password" minlength="6" />
							</div>
							<button type="submit" class="btn btn-primary btn-block">Register</button>
						</form>
						<div id="registerError" class="error-message" style="display: none;"></div>
					</div>
				</div>
			</div>
			
			<footer style="border: none; margin-top: 2rem;">
				<p>© 2024 zkSNARK Voting System. All rights reserved.</p>
				<p style="margin-top: 0.5rem; font-size: 0.85rem;">Powered by Zero-Knowledge Proofs</p>
			</footer>
		</div>
	`;
	
	attachEventListeners();
}

function attachEventListeners() {
	// Tab switching
	const tabs = document.querySelectorAll('.auth-tab');
	tabs.forEach(tab => {
		tab.addEventListener('click', (e) => {
			const target = e.target as HTMLButtonElement;
			const tabName = target.dataset.tab;
			
			// Update active tab
			tabs.forEach(t => t.classList.remove('active'));
			target.classList.add('active');
			
			// Update active form
			document.querySelectorAll('.auth-form').forEach(form => {
				form.classList.remove('active');
			});
			document.getElementById(`${tabName}Form`)?.classList.add('active');
			
			// Clear errors
			document.querySelectorAll('.error-message').forEach(err => {
				(err as HTMLElement).style.display = 'none';
			});
		});
	});
	
	// Login form
	const loginForm = document.getElementById('loginFormElement') as HTMLFormElement;
	if (loginForm) {
		loginForm.addEventListener('submit', handleLogin);
	}
	
	// Register form
	const registerForm = document.getElementById('registerFormElement') as HTMLFormElement;
	if (registerForm) {
		registerForm.addEventListener('submit', handleRegister);
	}
}

async function handleLogin(e: Event) {
	e.preventDefault();
	
	const form = e.target as HTMLFormElement;
	const formData = new FormData(form);
	const email = formData.get('email') as string;
	const password = formData.get('password') as string;
	
	const errorDiv = document.getElementById('loginError') as HTMLElement;
	const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
	
	try {
		submitBtn.disabled = true;
		submitBtn.textContent = 'Logging in...';
		errorDiv.style.display = 'none';
		
		await authService.login(email, password);
		
		// Redirect to main app
		window.location.href = '/';
	} catch (error: any) {
		const message = error.response?.data?.message || error.message || 'Login failed';
		errorDiv.textContent = message;
		errorDiv.style.display = 'block';
		submitBtn.disabled = false;
		submitBtn.textContent = 'Login';
	}
}

async function handleRegister(e: Event) {
	e.preventDefault();
	
	const form = e.target as HTMLFormElement;
	const formData = new FormData(form);
	const email = formData.get('email') as string;
	const password = formData.get('password') as string;
	const confirmPassword = formData.get('confirmPassword') as string;
	
	const errorDiv = document.getElementById('registerError') as HTMLElement;
	const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
	
	// Validate passwords match
	if (password !== confirmPassword) {
		errorDiv.textContent = 'Passwords do not match';
		errorDiv.style.display = 'block';
		return;
	}
	
	try {
		submitBtn.disabled = true;
		submitBtn.textContent = 'Creating account...';
		errorDiv.style.display = 'none';
		
		await authService.register(email, password);
		
		// Redirect to main app
		window.location.href = '/';
	} catch (error: any) {
		const message = error.response?.data?.message || error.message || 'Registration failed';
		errorDiv.textContent = message;
		errorDiv.style.display = 'block';
		submitBtn.disabled = false;
		submitBtn.textContent = 'Register';
	}
}

// Check if already authenticated
if (authService.isAuthenticated()) {
	window.location.href = '/';
} else {
	renderLoginPage();
}
