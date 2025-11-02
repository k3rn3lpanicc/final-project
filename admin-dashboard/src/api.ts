import axios from 'axios';
import { authService } from './auth';

const API_BASE_URL = 'http://localhost:3000';

// Add axios interceptor to include access token
axios.interceptors.request.use(
  (config) => {
    const token = authService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add axios interceptor to handle token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const newAccessToken = await authService.refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        authService.clearTokens();
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export interface Request {
  id: string;
  fullName: string;
  passportNumber: string;
  dateOfBirth: string;
  nationality: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto_rejected';
  voterId: string;
  secretX: string;
  hashXp: string; // Hash of secretXp
  electionId?: number;
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

export interface Election {
  id: number;
  name: string;
  description: string;
  options: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  auto_rejected: number;
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
      auto_rejected: requests.filter((r: Request) => r.status === 'auto_rejected').length,
    };
  },

  getImageUrl(requestId: string, type: 'passport' | 'photo'): string {
    // Return a data URL that will be fetched with proper auth headers
    return `${API_BASE_URL}/admin/request/${requestId}/image/${type}`;
  },
  
  async getImageBlob(requestId: string, type: 'passport' | 'photo'): Promise<string> {
    const response = await axios.get(`${API_BASE_URL}/admin/request/${requestId}/image/${type}`, {
      responseType: 'blob'
    });
    return URL.createObjectURL(response.data);
  },

  // Election management APIs
  async createElection(data: { name: string; description: string; options: string[] }): Promise<Election> {
    const response = await axios.post(`${API_BASE_URL}/admin/elections`, data);
    return response.data;
  },

  async getAllElections(): Promise<Election[]> {
    const response = await axios.get(`${API_BASE_URL}/admin/elections`);
    return response.data;
  },

  async getElectionById(id: number): Promise<Election> {
    const response = await axios.get(`${API_BASE_URL}/admin/elections/${id}`);
    return response.data;
  },

  async updateElection(id: number, data: Partial<Election>): Promise<Election> {
    const response = await axios.put(`${API_BASE_URL}/admin/elections/${id}`, data);
    return response.data;
  },

  async deleteElection(id: number): Promise<void> {
    await axios.delete(`${API_BASE_URL}/admin/elections/${id}`);
  },

  async getActiveElections(): Promise<Election[]> {
    const response = await axios.get(`${API_BASE_URL}/elections`);
    return response.data;
  }
};
