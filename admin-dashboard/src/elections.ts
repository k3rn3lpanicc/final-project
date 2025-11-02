import './styles/base.css';
import './styles/header.css';
import './styles/elections.css';
import './styles/common.css';

import { authService } from './services/auth';
import { initializeElections } from './components/elections';

if (!authService.isAuthenticated()) {
  window.location.href = '/login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await authService.logout();
      window.location.href = '/login.html';
    });
  }

  initializeElections();
});

