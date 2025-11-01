import './style.css';
import { api, Request } from './api';

let allRequests: Request[] = [];
let currentFilter: string = 'all';

async function loadRequests() {
  try {
    const requestsContainer = document.getElementById('requests-container')!;
    requestsContainer.innerHTML = '<p class="loading">Loading requests...</p>';

    allRequests = await api.getAllRequests();
    await updateStats();
    renderRequests();
  } catch (error) {
    console.error('Error loading requests:', error);
    const requestsContainer = document.getElementById('requests-container')!;
    requestsContainer.innerHTML = '<p class="error">Failed to load requests. Please check if the backend is running.</p>';
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

function renderRequests() {
  const requestsContainer = document.getElementById('requests-container')!;
  
  const filteredRequests = currentFilter === 'all' 
    ? allRequests 
    : allRequests.filter(r => r.status === currentFilter);

  if (filteredRequests.length === 0) {
    requestsContainer.innerHTML = '<p class="loading">No requests found.</p>';
    return;
  }

  requestsContainer.innerHTML = filteredRequests.map(request => `
    <div class="request-card" data-id="${request.id}">
      <div class="request-header">
        <span class="request-id">Request #${request.id.substring(0, 8)}</span>
        <span class="status-badge ${request.status}">${request.status}</span>
      </div>
      
      <div class="request-body">
        <div class="request-field">
          <label>Name</label>
          <p>${request.fullName}</p>
        </div>
        
        <div class="request-field">
          <label>Voter ID</label>
          <p>${request.voterId}</p>
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
          <label>Submitted</label>
          <p>${request.createdAt ? new Date(request.createdAt).toLocaleString() : 'N/A'}</p>
        </div>
        
        ${request.passportImagePath || request.photoImagePath ? `
        <div class="document-section">
          <label>Documents</label>
          <div class="document-images">
            ${request.passportImagePath ? `
            <div class="document-image" onclick="window.open('${api.getImageUrl(request.id, 'passport')}', '_blank')">
              <img src="${api.getImageUrl(request.id, 'passport')}" alt="Passport" />
              <p>Passport</p>
            </div>
            ` : ''}
            ${request.photoImagePath ? `
            <div class="document-image" onclick="window.open('${api.getImageUrl(request.id, 'photo')}', '_blank')">
              <img src="${api.getImageUrl(request.id, 'photo')}" alt="Personal Photo" />
              <p>Personal Photo</p>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}
      </div>
      
      <div class="request-actions">
        ${request.status === 'approved' ? `
          <button class="btn btn-view-signature" onclick="viewSignature('${request.id}')">
            View Signature
          </button>
        ` : request.status === 'pending' ? `
          <button class="btn btn-approve" onclick="approveRequest('${request.id}')">
            Approve
          </button>
          <button class="btn btn-reject" onclick="rejectRequest('${request.id}')">
            Reject
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
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
        <button class="btn btn-approve" style="margin-top: 20px; width: 100%;" onclick="copySignature('${request.signature.signatureR8x}', '${request.signature.signatureR8y}', '${request.signature.signatureS}', '${request.signature.publicKeyX}', '${request.signature.publicKeyY}')">
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
  const data = JSON.stringify({ signatureR8x: R8x, signatureR8y: R8y, signatureS: S, publicKeyX: pubX, publicKeyY: pubY }, null, 2);
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
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    (e.target as HTMLElement).classList.add('active');
    currentFilter = (e.target as HTMLElement).dataset.status || 'all';
    renderRequests();
  });
});

// Make functions globally available
(window as any).approveRequest = approveRequest;
(window as any).rejectRequest = rejectRequest;
(window as any).viewSignature = viewSignature;
(window as any).copySignature = copySignature;

// Auto-refresh every 30 seconds
setInterval(loadRequests, 30000);

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
