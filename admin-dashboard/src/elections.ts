import './style.css';
import { api } from './api';
import { authService } from './auth';

// Check authentication on page load
if (!authService.isAuthenticated()) {
  window.location.href = '/login.html';
}

// Add logout handler
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await authService.logout();
      window.location.href = '/login.html';
    });
  }
});

// Toast notification
function showToast(message: string, type: 'success' | 'error' = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  const container = document.getElementById('toast-container') || (() => {
    const c = document.createElement('div');
    c.id = 'toast-container';
    c.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px';
    document.body.appendChild(c);
    return c;
  })();
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Option management
let optionCount = 1;

function addOptionInput() {
  optionCount++;
  const container = document.getElementById('options-container')!;
  const optionDiv = document.createElement('div');
  optionDiv.className = 'option-input';
  optionDiv.innerHTML = `
    <input type="text" class="option-field" placeholder="Option ${optionCount}" required>
    <button type="button" class="btn-remove-option" title="Remove option">×</button>
  `;
  
  const removeBtn = optionDiv.querySelector('.btn-remove-option');
  removeBtn?.addEventListener('click', () => {
    const allOptions = document.querySelectorAll('.option-input');
    if (allOptions.length > 1) {
      optionDiv.remove();
    } else {
      showToast('At least one option is required', 'error');
    }
  });
  
  container.appendChild(optionDiv);
}

// Initialize event listeners after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const addOptionBtn = document.getElementById('add-option-btn');
  if (addOptionBtn) {
    addOptionBtn.addEventListener('click', addOptionInput);
  }
  
  // Handle remove button for initial option
  document.querySelectorAll('.btn-remove-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const optionInput = (e.target as HTMLElement).closest('.option-input');
      if (optionInput && document.querySelectorAll('.option-input').length > 1) {
        optionInput.remove();
      } else {
        showToast('At least one option is required', 'error');
      }
    });
  });
});

// Create election form handler
document.getElementById('create-election-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nameInput = document.getElementById('election-name') as HTMLInputElement;
  const descInput = document.getElementById('election-description') as HTMLTextAreaElement;
  const optionInputs = document.querySelectorAll('.option-field') as NodeListOf<HTMLInputElement>;
  
  const options = Array.from(optionInputs)
    .map(input => input.value.trim())
    .filter(value => value.length > 0);
  
  if (options.length < 2) {
    showToast('At least 2 options are required', 'error');
    return;
  }
  
  try {
    await api.createElection({
      name: nameInput.value.trim(),
      description: descInput.value.trim(),
      options
    });
    
    showToast('Election created successfully!', 'success');
    
    // Reset form
    nameInput.value = '';
    descInput.value = '';
    
    // Reset options to single input
    const container = document.getElementById('options-container')!;
    container.innerHTML = `
      <div class="option-input">
        <input type="text" class="option-field" placeholder="Option 1" required>
        <button type="button" class="btn-remove-option" title="Remove option">×</button>
      </div>
    `;
    optionCount = 1;
    
    // Re-attach event listeners
    document.querySelectorAll('.btn-remove-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const optionInput = (e.target as HTMLElement).closest('.option-input');
        if (optionInput && document.querySelectorAll('.option-input').length > 1) {
          optionInput.remove();
        } else {
          showToast('At least one option is required', 'error');
        }
      });
    });
    
    // Reload elections list
    await loadElections();
  } catch (error: any) {
    console.error('Error creating election:', error);
    showToast(error.response?.data?.message || 'Failed to create election', 'error');
  }
});

// Load and render elections
async function loadElections() {
  try {
    const container = document.getElementById('elections-container')!;
    container.innerHTML = '<p class="loading">Loading elections...</p>';
    
    const elections = await api.getAllElections();
    
    if (elections.length === 0) {
      container.innerHTML = '<p class="loading">No elections found.</p>';
      return;
    }
    
    container.innerHTML = elections.map(election => `
      <div class="election-card ${election.isActive ? 'active' : 'inactive'}">
        <div class="election-header">
          <h3>${escapeHtml(election.name)}</h3>
          <span class="election-status ${election.isActive ? 'status-active' : 'status-inactive'}">
            ${election.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p class="election-description">${escapeHtml(election.description)}</p>
        <div class="election-options">
          <strong>Options:</strong>
          <ul>
            ${election.options.map(opt => `<li>${escapeHtml(opt)}</li>`).join('')}
          </ul>
        </div>
        <div class="election-meta">
          <span>ID: ${election.id}</span>
          <span>Created: ${new Date(election.createdAt).toLocaleDateString()}</span>
        </div>
        <div class="election-actions">
          <button class="btn-toggle-status" data-id="${election.id}" data-active="${election.isActive}">
            ${election.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button class="btn-delete-election" data-id="${election.id}">Delete</button>
        </div>
      </div>
    `).join('');
    
    // Attach event listeners
    document.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.target as HTMLButtonElement;
        const id = parseInt(target.dataset.id!);
        const isActive = target.dataset.active === 'true';
        
        try {
          await api.updateElection(id, { isActive: !isActive });
          showToast(`Election ${!isActive ? 'activated' : 'deactivated'} successfully!`, 'success');
          await loadElections();
        } catch (error: any) {
          console.error('Error toggling election status:', error);
          showToast(error.response?.data?.message || 'Failed to update election', 'error');
        }
      });
    });
    
    document.querySelectorAll('.btn-delete-election').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.target as HTMLButtonElement;
        const id = parseInt(target.dataset.id!);
        
        if (!confirm('Are you sure you want to delete this election? This action cannot be undone.')) {
          return;
        }
        
        try {
          await api.deleteElection(id);
          showToast('Election deleted successfully!', 'success');
          await loadElections();
        } catch (error: any) {
          console.error('Error deleting election:', error);
          showToast(error.response?.data?.message || 'Failed to delete election', 'error');
        }
      });
    });
  } catch (error) {
    console.error('Error loading elections:', error);
    const container = document.getElementById('elections-container')!;
    container.innerHTML = '<p class="error">Failed to load elections.</p>';
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load elections on page load
loadElections();
