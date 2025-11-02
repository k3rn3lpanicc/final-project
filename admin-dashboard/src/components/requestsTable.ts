import { api } from '../services/api';
import { Request, PaginatedResponse } from '../types';
import { showNotification } from '../utils/notifications';
import { generatePageNumbers } from '../utils/pagination';
import { viewDetails, viewSignature } from './modals';

let currentPage: number = 1;
let itemsPerPage: number = 10;
let totalPages: number = 1;
let currentFilter: string = 'all';
let currentElectionFilter: number | undefined = undefined;

export function initializeRequestsTable() {
  const urlParams = new URLSearchParams(window.location.search);
  currentPage = parseInt(urlParams.get('page') || localStorage.getItem('currentPage') || '1');
  currentFilter = urlParams.get('filter') || localStorage.getItem('currentFilter') || 'all';
  const electionId = urlParams.get('electionId') || localStorage.getItem('currentElectionFilter');
  currentElectionFilter = electionId ? parseInt(electionId) : undefined;

  setupFilterButtons();
  setupElectionFilter();
  const filterBtn = document.querySelector(`.filter-btn[data-status="${currentFilter}"]`);
  if (filterBtn) {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    filterBtn.classList.add('active');
  }

  loadRequests();
  setInterval(() => loadRequests(true), 30000);
}

function setupFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      (e.target as HTMLElement).classList.add('active');
      currentFilter = (e.target as HTMLElement).dataset.status || 'all';
      currentPage = 1;
      loadRequests();
    });
  });
}

async function setupElectionFilter() {
  const electionFilterSelect = document.getElementById('election-filter') as HTMLSelectElement;
  if (!electionFilterSelect) return;

  try {
    const elections = await api.getAllElections();
    electionFilterSelect.innerHTML = `
      <option value="">All Elections</option>
      ${elections.map(e => `<option value="${e.id}" ${currentElectionFilter === e.id ? 'selected' : ''}>${e.name} (ID: ${e.id})</option>`).join('')}
    `;

    electionFilterSelect.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      currentElectionFilter = value ? parseInt(value) : undefined;
      currentPage = 1;
      loadRequests();
    });
  } catch (error) {
    console.error('Error loading elections:', error);
  }
}

export async function loadRequests(preserveScroll: boolean = false) {
  try {
    const scrollPosition = preserveScroll ? window.scrollY : 0;
    const requestsContainer = document.getElementById('requests-container')!;

    if (!preserveScroll) {
      requestsContainer.innerHTML = '<p class="loading">Loading requests...</p>';
    }

    const statusFilter = currentFilter === 'all' ? undefined : currentFilter;
    const response: PaginatedResponse<Request> = await api.getAllRequests(currentPage, itemsPerPage, statusFilter, currentElectionFilter);

    await updateStats();
    renderRequests(response);
    updatePageState();

    if (preserveScroll) {
      window.scrollTo(0, scrollPosition);
    }
  } catch (error) {
    console.error('Error loading requests:', error);
    const requestsContainer = document.getElementById('requests-container')!;
    requestsContainer.innerHTML = '<p class="error">Failed to load requests. Please check if the backend is running.</p>';
  }
}

function updatePageState() {
  const url = new URL(window.location.href);
  url.searchParams.set('page', currentPage.toString());
  url.searchParams.set('filter', currentFilter);
  if (currentElectionFilter !== undefined) {
    url.searchParams.set('electionId', currentElectionFilter.toString());
    localStorage.setItem('currentElectionFilter', currentElectionFilter.toString());
  } else {
    url.searchParams.delete('electionId');
    localStorage.removeItem('currentElectionFilter');
  }
  window.history.replaceState({}, '', url.toString());

  localStorage.setItem('currentPage', currentPage.toString());
  localStorage.setItem('currentFilter', currentFilter);
}

async function updateStats() {
  try {
    const stats = await api.getStats();
    document.getElementById('pending-count')!.textContent = stats.pending.toString();
    document.getElementById('approved-count')!.textContent = stats.approved.toString();
    document.getElementById('rejected-count')!.textContent = stats.rejected.toString();
    document.getElementById('auto-rejected-count')!.textContent = stats.auto_rejected.toString();
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

function renderRequests(response: PaginatedResponse<Request>) {
  const requestsContainer = document.getElementById('requests-container')!;
  const { data: requests, pagination } = response;
  totalPages = pagination.totalPages;

  if (requests.length === 0) {
    requestsContainer.innerHTML = '<p class="loading">No requests found.</p>';
    return;
  }

  requestsContainer.innerHTML = `
    <table class="requests-table">
      <thead>
        <tr>
          <th>Request ID</th>
          <th>Election ID</th>
          <th>Name</th>
          <th>Date of Birth</th>
          <th>Nationality</th>
          <th>Passport Number</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${requests.map((request) => createRequestRow(request)).join('')}
      </tbody>
    </table>
    
    <div class="pagination">
      <button class="btn-page" onclick="goToPage(${pagination.currentPage - 1})" ${!pagination.hasPrevPage ? 'disabled' : ''}>Previous</button>
      ${generatePageNumbers(pagination.currentPage, pagination.totalPages)}
      <button class="btn-page" onclick="goToPage(${pagination.currentPage + 1})" ${!pagination.hasNextPage ? 'disabled' : ''}>Next</button>
    </div>
  `;

  attachEventListeners();
}

function createRequestRow(request: Request): string {
  return `
    <tr data-id="${request.id}">
      <td><span class="truncated-id" data-full-id="${request.id}" title="${request.id}">${request.id.substring(0, 8)}...</span></td>
      <td>${request.electionId || 'N/A'}</td>
      <td>${request.fullName}</td>
      <td>${new Date(request.dateOfBirth).toLocaleDateString()}</td>
      <td>${request.nationality}</td>
      <td>${request.passportNumber}</td>
      <td><span class="status-badge ${request.status}">${request.status === 'auto_rejected' ? 'auto rejected' : request.status}</span></td>
      <td>
        <div class="action-menu-container">
          <button class="btn-menu" data-request-id="${request.id}"></button>
          <div class="action-menu" id="menu-${request.id}">
            <button data-action="viewDetails" data-request-id="${request.id}">Additional Details</button>
            ${request.status === 'pending' ? `
              <button data-action="approve" data-request-id="${request.id}" class="menu-approve">Approve</button>
              <button data-action="reject" data-request-id="${request.id}" class="menu-reject">Reject</button>
            ` : ''}
            ${request.status === 'approved' ? `
              <button data-action="viewSignature" data-request-id="${request.id}">View Signature</button>
            ` : ''}
          </div>
        </div>
      </td>
    </tr>
  `;
}

function attachEventListeners() {
  document.querySelectorAll('.btn-menu').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const requestId = (e.target as HTMLElement).getAttribute('data-request-id');
      if (requestId) toggleActionMenu(e, requestId);
    });
  });

  document.querySelectorAll('.action-menu button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const action = (e.target as HTMLElement).getAttribute('data-action');
      const requestId = (e.target as HTMLElement).getAttribute('data-request-id');
      if (!requestId) return;

      // Close the action menu
      document.querySelectorAll('.action-menu').forEach((menu) => {
        menu.classList.remove('active');
      });

      try {
        switch (action) {
          case 'viewDetails':
            await viewDetails(requestId);
            break;
          case 'approve':
            await approveRequest(requestId);
            break;
          case 'reject':
            await rejectRequest(requestId);
            break;
          case 'viewSignature':
            const request = await api.getRequestDetails(requestId);
            viewSignature(request);
            break;
        }
      } catch (error) {
        console.error('Error handling action:', action, error);
        showNotification('An error occurred. Please try again.', 'error');
      }
    });
  });

  document.querySelectorAll('.truncated-id').forEach((elem) => {
    elem.addEventListener('click', (e) => {
      const fullId = (e.target as HTMLElement).getAttribute('data-full-id');
      if (fullId) {
        navigator.clipboard.writeText(fullId);
        showNotification('Request ID copied to clipboard!', 'success');
      }
    });
  });
}

async function approveRequest(id: string) {
  const btn = event?.target as HTMLButtonElement;
  if (btn) btn.disabled = true;

  try {
    await api.approveRequest(id);
    showNotification('Request approved successfully!', 'success');
    await loadRequests(true);
  } catch (error) {
    console.error('Error approving request:', error);
    showNotification('Failed to approve request', 'error');
    if (btn) btn.disabled = false;
  }
}

async function rejectRequest(id: string) {
  const btn = event?.target as HTMLButtonElement;
  if (btn) btn.disabled = true;

  if (!confirm('Are you sure you want to reject this request?')) {
    if (btn) btn.disabled = false;
    return;
  }

  try {
    await api.rejectRequest(id);
    showNotification('Request rejected', 'success');
    await loadRequests(true);
  } catch (error) {
    console.error('Error rejecting request:', error);
    showNotification('Failed to reject request', 'error');
    if (btn) btn.disabled = false;
  }
}

function toggleActionMenu(event: Event, requestId: string) {
  event.stopPropagation();

  document.querySelectorAll('.action-menu').forEach((menu) => {
    if (menu.id !== `menu-${requestId}`) {
      menu.classList.remove('active');
    }
  });

  const menu = document.getElementById(`menu-${requestId}`);
  if (!menu) return;

  const isOpening = !menu.classList.contains('active');
  menu.classList.toggle('active');

  if (isOpening) {
    const button = event.target as HTMLElement;
    const buttonRect = button.getBoundingClientRect();

    menu.style.top = `${buttonRect.bottom + 5}px`;
    menu.style.left = `${buttonRect.right - 200}px`;

    requestAnimationFrame(() => {
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.bottom > window.innerHeight) {
        menu.style.top = `${buttonRect.top - menuRect.height - 5}px`;
      }

      if (menuRect.left < 0) {
        menu.style.left = '10px';
      }
    });
  }
}

document.addEventListener('click', () => {
  document.querySelectorAll('.action-menu').forEach((menu) => {
    menu.classList.remove('active');
  });
});

export function goToPage(page: number) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadRequests();
}

(window as any).goToPage = goToPage;
