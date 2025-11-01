import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

export interface Request {
  id: string;
  fullName: string;
  passportNumber: string;
  dateOfBirth: string;
  nationality: string;
  status: 'pending' | 'approved' | 'rejected';
  voterId: string;
  secretX: string;
  secretXp: string;
  createdAt?: string;
  passportImagePath?: string;
  photoImagePath?: string;
  signature?: {
    signatureR8x: string;
    signatureR8y: string;
    signatureS: string;
    publicKeyX: string;
    publicKeyY: string;
  };
}

export interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export const api = {
  async getAllRequests(): Promise<Request[]> {
    const response = await axios.get(`${API_BASE_URL}/admin/requests`);
    return response.data;
  },

  async getRequestDetails(id: string): Promise<Request> {
    const response = await axios.get(`${API_BASE_URL}/admin/request/${id}`);
    return response.data;
  },

  async approveRequest(id: string): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/admin/request/${id}/approve`, {});
    return response.data;
  },

  async rejectRequest(id: string): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/admin/request/${id}/reject`, {});
    return response.data;
  },

  async getStats(): Promise<Stats> {
    const requests = await this.getAllRequests();
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
    };
  },

  getImageUrl(requestId: string, type: 'passport' | 'photo'): string {
    return `${API_BASE_URL}/admin/request/${requestId}/image/${type}`;
  }
};
