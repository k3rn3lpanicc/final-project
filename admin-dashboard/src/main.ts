import './styles/base.css';
import './styles/header.css';
import './styles/stats.css';
import './styles/requests.css';
import './styles/actions.css';
import './styles/modal.css';
import './styles/pagination.css';
import './styles/common.css';

import { authService } from './services/auth';
import { initializeRequestsTable } from './components/requestsTable';

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

  initializeRequestsTable();
});

