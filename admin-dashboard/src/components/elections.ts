import { api } from '../services/api';
import { Election, CreateElectionData } from '../types';
import { showNotification } from '../utils/notifications';

let optionCount = 1;

export function initializeElections() {
  setupFormHandlers();
  loadElections();
}

function setupFormHandlers() {
  const addOptionBtn = document.getElementById('add-option-btn');
  if (addOptionBtn) {
    addOptionBtn.addEventListener('click', addOptionInput);
  }

  document.querySelectorAll('.btn-remove-option').forEach((btn) => {
    btn.addEventListener('click', handleRemoveOption);
  });

  const form = document.getElementById('create-election-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
}

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
  removeBtn?.addEventListener('click', handleRemoveOption);

  container.appendChild(optionDiv);
}

function handleRemoveOption(e: Event) {
  const optionInput = (e.target as HTMLElement).closest('.option-input');
  const allOptions = document.querySelectorAll('.option-input');

  if (allOptions.length > 1 && optionInput) {
    optionInput.remove();
  } else {
    showNotification('At least one option is required', 'error');
  }
}

async function handleFormSubmit(e: Event) {
  e.preventDefault();

  const nameInput = document.getElementById('election-name') as HTMLInputElement;
  const descInput = document.getElementById('election-description') as HTMLTextAreaElement;
  const optionInputs = document.querySelectorAll('.option-field') as NodeListOf<HTMLInputElement>;

  const options = Array.from(optionInputs)
    .map((input) => input.value.trim())
    .filter((value) => value.length > 0);

  if (options.length < 2) {
    showNotification('At least 2 options are required', 'error');
    return;
  }

  try {
    const data: CreateElectionData = {
      name: nameInput.value.trim(),
      description: descInput.value.trim(),
      options,
    };

    await api.createElection(data);
    showNotification('Election created successfully!', 'success');

    resetForm();
    await loadElections();
  } catch (error: any) {
    console.error('Error creating election:', error);
    showNotification(error.response?.data?.message || 'Failed to create election', 'error');
  }
}

function resetForm() {
  const nameInput = document.getElementById('election-name') as HTMLInputElement;
  const descInput = document.getElementById('election-description') as HTMLTextAreaElement;

  nameInput.value = '';
  descInput.value = '';

  const container = document.getElementById('options-container')!;
  container.innerHTML = `
    <div class="option-input">
      <input type="text" class="option-field" placeholder="Option 1" required>
      <button type="button" class="btn-remove-option" title="Remove option">×</button>
    </div>
  `;
  optionCount = 1;

  document.querySelectorAll('.btn-remove-option').forEach((btn) => {
    btn.addEventListener('click', handleRemoveOption);
  });
}

export async function loadElections() {
  try {
    const container = document.getElementById('elections-container')!;
    container.innerHTML = '<p class="loading">Loading elections...</p>';

    const elections = await api.getAllElections();

    if (elections.length === 0) {
      container.innerHTML = '<p class="loading">No elections found.</p>';
      return;
    }

    container.innerHTML = elections.map((election) => createElectionCard(election)).join('');
    attachElectionEventListeners();
  } catch (error) {
    console.error('Error loading elections:', error);
    const container = document.getElementById('elections-container')!;
    container.innerHTML = '<p class="error">Failed to load elections.</p>';
  }
}

function createElectionCard(election: Election): string {
  return `
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
          ${election.options.map((opt) => `<li>${escapeHtml(opt)}</li>`).join('')}
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
  `;
}

function attachElectionEventListeners() {
  document.querySelectorAll('.btn-toggle-status').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLButtonElement;
      const id = parseInt(target.dataset.id!);
      const isActive = target.dataset.active === 'true';

      try {
        await api.updateElection(id, { isActive: !isActive });
        showNotification(`Election ${!isActive ? 'activated' : 'deactivated'} successfully!`, 'success');
        await loadElections();
      } catch (error: any) {
        console.error('Error toggling election status:', error);
        showNotification(error.response?.data?.message || 'Failed to update election', 'error');
      }
    });
  });

  document.querySelectorAll('.btn-delete-election').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLButtonElement;
      const id = parseInt(target.dataset.id!);

      if (!confirm('Are you sure you want to delete this election? This action cannot be undone.')) {
        return;
      }

      try {
        await api.deleteElection(id);
        showNotification('Election deleted successfully!', 'success');
        await loadElections();
      } catch (error: any) {
        console.error('Error deleting election:', error);
        showNotification(error.response?.data?.message || 'Failed to delete election', 'error');
      }
    });
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
