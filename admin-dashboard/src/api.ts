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

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export const api = {
  async getAllRequests(page: number = 1, limit: number = 10, status?: string): Promise<PaginatedResponse<Request>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status) {
      params.append('status', status);
    }
    const response = await axios.get(`${API_BASE_URL}/admin/requests?${params}`);
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
    // Get total counts without pagination
    const allRequests = await axios.get(`${API_BASE_URL}/admin/requests?limit=1000`);
    const requests = allRequests.data.data;
    return {
      total: allRequests.data.pagination.totalItems,
      pending: requests.filter((r: Request) => r.status === 'pending').length,
      approved: requests.filter((r: Request) => r.status === 'approved').length,
      rejected: requests.filter((r: Request) => r.status === 'rejected').length,
    };
  },

  getImageUrl(requestId: string, type: 'passport' | 'photo'): string {
    return `${API_BASE_URL}/admin/request/${requestId}/image/${type}`;
  }
};
