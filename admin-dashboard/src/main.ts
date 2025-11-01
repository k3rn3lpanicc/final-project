import './style.css';
import { api, Request, PaginatedResponse } from './api';

let currentPage: number = 1;
let itemsPerPage: number = 10;
let totalPages: number = 1;
let currentFilter: string = 'all';

async function loadRequests(preserveScroll: boolean = false) {
	try {
		const scrollPosition = preserveScroll ? window.scrollY : 0;
		const requestsContainer = document.getElementById('requests-container')!;
		
		// Don't show loading message on auto-refresh to avoid UI flicker
		if (!preserveScroll) {
			requestsContainer.innerHTML = '<p class="loading">Loading requests...</p>';
		}

		const statusFilter = currentFilter === 'all' ? undefined : currentFilter;
		const response: PaginatedResponse<Request> = await api.getAllRequests(currentPage, itemsPerPage, statusFilter);
		
		await updateStats();
		renderRequests(response);
		
		// Restore scroll position if preserving
		if (preserveScroll) {
			window.scrollTo(0, scrollPosition);
		}
	} catch (error) {
		console.error('Error loading requests:', error);
		const requestsContainer = document.getElementById('requests-container')!;
		requestsContainer.innerHTML =
			'<p class="error">Failed to load requests. Please check if the backend is running.</p>';
	}
}

async function updateStats() {
	try {
		const stats = await api.getStats();
		document.getElementById('pending-count')!.textContent = stats.pending.toString();
		document.getElementById('approved-count')!.textContent = stats.approved.toString();
		document.getElementById('rejected-count')!.textContent = stats.rejected.toString();
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
          <th>Name</th>
          <th>Date of Birth</th>
          <th>Nationality</th>
          <th>Passport Number</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${requests
			.map(
				(request) => `
          <tr data-id="${request.id}">
            <td><span class="truncated-id" data-full-id="${request.id}" title="${request.id}">${request.id.substring(0, 8)}...</span></td>
            <td>${request.fullName}</td>
            <td>${new Date(request.dateOfBirth).toLocaleDateString()}</td>
            <td>${request.nationality}</td>
            <td>${request.passportNumber}</td>
            <td><span class="status-badge ${request.status}">${request.status}</span></td>
            <td>
              <div class="action-menu-container">
                <button class="btn-menu" data-request-id="${request.id}">
                </button>
                <div class="action-menu" id="menu-${request.id}">
                  <button data-action="viewDetails" data-request-id="${
						request.id
					}">Additional Details</button>
                  ${
						request.status === 'pending'
							? `
                    <button data-action="approve" data-request-id="${request.id}" class="menu-approve">Approve</button>
                    <button data-action="reject" data-request-id="${request.id}" class="menu-reject">Reject</button>
                  `
							: ''
					}
                  ${
						request.status === 'approved'
							? `
                    <button data-action="viewSignature" data-request-id="${request.id}">View Signature</button>
                  `
							: ''
					}
                </div>
              </div>
            </td>
          </tr>
        `
			)
			.join('')}
      </tbody>
    </table>
    
    <div class="pagination">
      <button class="btn-page" onclick="goToPage(${pagination.currentPage - 1})" ${!pagination.hasPrevPage ? 'disabled' : ''}>Previous</button>
      ${generatePageNumbers(pagination.currentPage, pagination.totalPages)}
      <button class="btn-page" onclick="goToPage(${pagination.currentPage + 1})" ${!pagination.hasNextPage ? 'disabled' : ''}>Next</button>
    </div>
  `;

	// Add event listeners to menu buttons
	document.querySelectorAll('.btn-menu').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const requestId = (e.target as HTMLElement).getAttribute('data-request-id');
			if (requestId) toggleActionMenu(e, requestId);
		});
	});

	// Add event listeners to action buttons
	document.querySelectorAll('.action-menu button[data-action]').forEach((btn) => {
		btn.addEventListener('click', async (e) => {
			const action = (e.target as HTMLElement).getAttribute('data-action');
			const requestId = (e.target as HTMLElement).getAttribute('data-request-id');
			if (!requestId) return;

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
					await viewSignature(requestId);
					break;
			}
		});
	});

	// Add event listeners to truncated IDs for clipboard copy
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
		await loadRequests();
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
		await loadRequests();
	} catch (error) {
		console.error('Error rejecting request:', error);
		showNotification('Failed to reject request', 'error');
		if (btn) btn.disabled = false;
	}
}

async function viewDetails(id: string) {
	try {
		const request = await api.getRequestDetails(id);

		const modal = document.createElement('div');
		modal.className = 'modal active';
		modal.innerHTML = `
      <div class="modal-content modal-details">
        <span class="modal-close" onclick="this.parentElement.parentElement.remove()">&times;</span>
        <h2>Request Details - #${id.substring(0, 8)}</h2>
        
        <div class="details-grid">
          <div class="request-field">
            <label>Full Name</label>
            <p>${request.fullName}</p>
          </div>
          
          <div class="request-field voter-id-field">
            <label>Voter ID</label>
            <p class="voter-id-text">${request.voterId}</p>
          </div>
          
          <div class="request-field">
            <label>Date of Birth</label>
            <p>${new Date(request.dateOfBirth).toLocaleDateString()}</p>
          </div>
          
          <div class="request-field">
            <label>Passport Number</label>
            <p>${request.passportNumber}</p>
          </div>
          
          <div class="request-field">
            <label>Nationality</label>
            <p>${request.nationality}</p>
          </div>
          
          <div class="request-field">
            <label>Status</label>
            <p><span class="status-badge ${request.status}">${request.status}</span></p>
          </div>
        </div>
        
        ${
			request.passportImagePath || request.photoImagePath
				? `
        <div class="document-section">
          <h3>Documents</h3>
          <div class="document-images-modal">
            ${
				request.passportImagePath
					? `
            <div class="document-modal-item">
              <label>Passport</label>
              <img src="${api.getImageUrl(
					request.id,
					'passport'
				)}" alt="Passport" onclick="window.open('${api.getImageUrl(
							request.id,
							'passport'
					  )}', '_blank')" />
            </div>
            `
					: ''
			}
            ${
				request.photoImagePath
					? `
            <div class="document-modal-item">
              <label>Personal Photo</label>
              <img src="${api.getImageUrl(
					request.id,
					'photo'
				)}" alt="Personal Photo" onclick="window.open('${api.getImageUrl(
							request.id,
							'photo'
					  )}', '_blank')" />
            </div>
            `
					: ''
			}
          </div>
        </div>
        `
				: ''
		}
      </div>
    `;
		document.body.appendChild(modal);
	} catch (error) {
		console.error('Error viewing details:', error);
		showNotification('Failed to load request details', 'error');
	}
}

async function viewSignature(id: string) {
	try {
		// Fetch full request details including signature
		const request = await api.getRequestDetails(id);

		if (!request.signature) {
			showNotification('Signature not available', 'error');
			return;
		}

		const modal = document.createElement('div');
		modal.className = 'modal active';
		modal.innerHTML = `
      <div class="modal-content">
        <span class="modal-close" onclick="this.parentElement.parentElement.remove()">&times;</span>
        <h2>Signature Data - Request #${id.substring(0, 8)}</h2>
        <div class="request-field">
          <label>Name</label>
          <p>${request.fullName}</p>
        </div>
        <div class="request-field">
          <label>Voter ID</label>
          <p>${request.voterId}</p>
        </div>
        <div class="signature-data">
          <strong>R8x:</strong><br/>
          ${request.signature.signatureR8x}<br/><br/>
          <strong>R8y:</strong><br/>
          ${request.signature.signatureR8y}<br/><br/>
          <strong>S:</strong><br/>
          ${request.signature.signatureS}<br/><br/>
          <strong>Public Key X:</strong><br/>
          ${request.signature.publicKeyX}<br/><br/>
          <strong>Public Key Y:</strong><br/>
          ${request.signature.publicKeyY}
        </div>
        <button class="btn btn-approve" style="margin-top: 20px; width: 100%;" onclick="copySignature('${
			request.signature.signatureR8x
		}', '${request.signature.signatureR8y}', '${request.signature.signatureS}', '${
			request.signature.publicKeyX
		}', '${request.signature.publicKeyY}')">
          Copy Signature Data
        </button>
      </div>
    `;
		document.body.appendChild(modal);
	} catch (error) {
		console.error('Error fetching signature:', error);
		showNotification('Failed to fetch signature data', 'error');
	}
}

function copySignature(R8x: string, R8y: string, S: string, pubX: string, pubY: string) {
	const data = JSON.stringify(
		{ signatureR8x: R8x, signatureR8y: R8y, signatureS: S, publicKeyX: pubX, publicKeyY: pubY },
		null,
		2
	);
	navigator.clipboard.writeText(data);
	showNotification('Signature copied to clipboard!', 'success');
}

function showNotification(message: string, type: 'success' | 'error') {
	const notification = document.createElement('div');
	notification.className = type;
	notification.textContent = message;
	notification.style.position = 'fixed';
	notification.style.top = '20px';
	notification.style.right = '20px';
	notification.style.zIndex = '2000';
	notification.style.minWidth = '250px';
	notification.style.animation = 'slideIn 0.3s ease-out';

	document.body.appendChild(notification);

	setTimeout(() => {
		notification.style.animation = 'slideOut 0.3s ease-out';
		setTimeout(() => notification.remove(), 300);
	}, 3000);
}

// Setup filter buttons
document.querySelectorAll('.filter-btn').forEach((btn) => {
	btn.addEventListener('click', (e) => {
		document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
		(e.target as HTMLElement).classList.add('active');
		currentFilter = (e.target as HTMLElement).dataset.status || 'all';
		currentPage = 1; // Reset to first page when filtering
		loadRequests();
	});
});

function generatePageNumbers(current: number, total: number): string {
	const pages: (number | string)[] = [];
	const maxVisible = 7;

	if (total <= maxVisible) {
		// Show all pages
		for (let i = 1; i <= total; i++) {
			pages.push(i);
		}
	} else {
		// Always show first page
		pages.push(1);

		if (current > 3) {
			pages.push('...');
		}

		// Show pages around current
		const start = Math.max(2, current - 1);
		const end = Math.min(total - 1, current + 1);

		for (let i = start; i <= end; i++) {
			pages.push(i);
		}

		if (current < total - 2) {
			pages.push('...');
		}

		// Always show last page
		if (total > 1) {
			pages.push(total);
		}
	}

	return pages
		.map((page) => {
			if (page === '...') {
				return '<span class="page-ellipsis">...</span>';
			}
			const isActive = page === current ? 'active' : '';
			return `<button class="btn-page-num ${isActive}" onclick="goToPage(${page})">${page}</button>`;
		})
		.join('');
}

function goToPage(page: number) {
	if (page < 1 || page > totalPages) return;
	currentPage = page;
	loadRequests();
}

function toggleActionMenu(event: Event, requestId: string) {
	event.stopPropagation();

	// Close all other menus
	document.querySelectorAll('.action-menu').forEach((menu) => {
		if (menu.id !== `menu-${requestId}`) {
			menu.classList.remove('active');
		}
	});

	// Toggle current menu
	const menu = document.getElementById(`menu-${requestId}`);
	menu?.classList.toggle('active');
}

// Close menus when clicking outside
document.addEventListener('click', () => {
	document.querySelectorAll('.action-menu').forEach((menu) => {
		menu.classList.remove('active');
	});
});

// Make functions globally available
(window as any).approveRequest = approveRequest;
(window as any).rejectRequest = rejectRequest;
(window as any).viewSignature = viewSignature;
(window as any).viewDetails = viewDetails;
(window as any).copySignature = copySignature;
(window as any).toggleActionMenu = toggleActionMenu;
(window as any).goToPage = goToPage;

// Auto-refresh every 30 seconds, preserving scroll position
setInterval(() => loadRequests(true), 30000);

// Initial load
loadRequests();

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
