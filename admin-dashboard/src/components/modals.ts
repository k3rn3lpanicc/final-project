import { api } from '../services/api';
import { Request } from '../types';
import { setupModalCloseHandlers } from '../utils/modal';
import { showNotification } from '../utils/notifications';

export async function viewDetails(id: string) {
  try {
    const request = await api.getRequestDetails(id);
    if (!request) {
      showNotification('Failed to load request details', 'error');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content modal-details">
        <span class="modal-close">&times;</span>
        <h2>Request Details - #${id.substring(0, 8)}</h2>
        
        <div class="details-grid">
          <div class="request-field">
            <label>Full Name</label>
            <p>${escapeHtml(request.fullName)}</p>
          </div>
          
          <div class="request-field voter-id-field">
            <label>Voter ID</label>
            <p class="voter-id-text">${escapeHtml(request.voterId)}</p>
          </div>
          
          <div class="request-field">
            <label>Date of Birth</label>
            <p>${new Date(request.dateOfBirth).toLocaleDateString()}</p>
          </div>
          
          <div class="request-field">
            <label>Passport Number</label>
            <p>${escapeHtml(request.passportNumber)}</p>
          </div>
          
          <div class="request-field">
            <label>Nationality</label>
            <p>${escapeHtml(request.nationality)}</p>
          </div>
          
          <div class="request-field">
            <label>Election ID</label>
            <p>${request.electionId}</p>
          </div>
          
          <div class="request-field">
            <label>Status</label>
            <p><span class="status-badge ${request.status}">${request.status === 'auto_rejected' ? 'auto rejected' : request.status}</span></p>
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
              <img data-image-id="${request.id}" data-image-type="passport" alt="Passport" style="cursor: pointer;" />
            </div>
            `
                : ''
            }
            ${
              request.photoImagePath
                ? `
            <div class="document-modal-item">
              <label>Personal Photo</label>
              <img data-image-id="${request.id}" data-image-type="photo" alt="Personal Photo" style="cursor: pointer;" />
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

    const images = modal.querySelectorAll('img[data-image-id]');
    for (const img of Array.from(images)) {
      const imageId = img.getAttribute('data-image-id');
      const imageType = img.getAttribute('data-image-type') as 'passport' | 'photo';
      if (imageId && imageType) {
        try {
          const blobUrl = await api.getImageBlob(imageId, imageType);
          (img as HTMLImageElement).src = blobUrl;
          img.addEventListener('click', () => window.open(blobUrl, '_blank'));
        } catch (error) {
          console.error(`Error loading ${imageType} image:`, error);
          (img as HTMLImageElement).alt = `Failed to load ${imageType}`;
        }
      }
    }

    setupModalCloseHandlers(modal);
  } catch (error) {
    console.error('Error viewing details:', error);
    showNotification('Failed to load request details', 'error');
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function viewSignature(request: Request) {
  if (!request.signature) {
    showNotification('Signature not available', 'error');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content modal-details">
      <span class="modal-close">&times;</span>
      <h2>Signature Data - Request #${request.id.substring(0, 8)}</h2>
      <div class="request-field">
        <label>Name</label>
        <p>${escapeHtml(request.fullName)}</p>
      </div>
      <div class="request-field voter-id-field">
        <label>Voter ID</label>
        <p class="voter-id-text">${escapeHtml(request.voterId)}</p>
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
      <button class="btn btn-approve" style="margin-top: 20px; width: 100%;" data-action="copy-signature">
        Copy Signature Data
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  const copyBtn = modal.querySelector('[data-action="copy-signature"]');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const data = JSON.stringify(request.signature, null, 2);
      navigator.clipboard.writeText(data);
      showNotification('Signature copied to clipboard!', 'success');
    });
  }

  setupModalCloseHandlers(modal);
}
