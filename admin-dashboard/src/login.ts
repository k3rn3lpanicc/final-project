import './styles/base.css';
import './styles/login.css';
import { authService } from './services/auth';

document.addEventListener('DOMContentLoaded', () => {
  // Check if already authenticated
  if (authService.isAuthenticated()) {
    window.location.href = '/dashboard.html';
    return;
  }

  const loginForm = document.getElementById('login-form') as HTMLFormElement;
  const errorMessage = document.getElementById('error-message') as HTMLDivElement;
  const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
  const loginText = document.getElementById('login-text') as HTMLSpanElement;
  const loginSpinner = document.getElementById('login-spinner') as HTMLSpanElement;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = (document.getElementById('username') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;

    // Show loading state
    loginBtn.disabled = true;
    loginText.style.display = 'none';
    loginSpinner.style.display = 'inline-block';
    errorMessage.style.display = 'none';

    try {
      await authService.login(username, password);
      window.location.href = '/dashboard.html';
    } catch (error) {
      // Show error
      errorMessage.textContent = 'Invalid username or password. Please try again.';
      errorMessage.style.display = 'block';
      
      // Reset loading state
      loginBtn.disabled = false;
      loginText.style.display = 'inline';
      loginSpinner.style.display = 'none';
    }
  });
});
