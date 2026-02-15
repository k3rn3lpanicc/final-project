import axios from 'axios';
import { authService } from './auth';
import { Request, Election, PaginatedResponse, Stats, CreateElectionData } from '../types';

// const API_BASE_URL = 'https://votingbackend.emit-aut.ir';
const API_BASE_URL = 'http://127.0.0.1:3000';

axios.interceptors.request.use(
	(config) => {
		const token = authService.getAccessToken();
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error),
);

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
	},
);

export const api = {
	async getAllRequests(
		page: number = 1,
		limit: number = 10,
		status?: string,
		electionId?: number,
	): Promise<PaginatedResponse<Request>> {
		const params = new URLSearchParams({
			page: page.toString(),
			limit: limit.toString(),
		});

		if (status) {
			params.append('status', status);
		}

		if (electionId !== undefined) {
			params.append('electionId', electionId.toString());
		}

		const response = await axios.get(`${API_BASE_URL}/admin/requests?${params.toString()}`);
		return response.data;
	},

	async getRequestDetails(id: string): Promise<Request> {
		const response = await axios.get(`${API_BASE_URL}/admin/request/${id}`);
		return response.data;
	},

	async approveRequest(id: string): Promise<void> {
		await axios.post(`${API_BASE_URL}/admin/request/${id}/approve`, {});
	},

	async rejectRequest(id: string): Promise<void> {
		await axios.post(`${API_BASE_URL}/admin/request/${id}/reject`, {});
	},

	async getStats(): Promise<Stats> {
		const response = await axios.get(`${API_BASE_URL}/admin/stats`);
		return response.data;
	},

	async getImageBlob(requestId: string, imageType: 'passport' | 'photo'): Promise<string> {
		const token = authService.getAccessToken();
		const response = await axios.get(
			`${API_BASE_URL}/admin/request/${requestId}/image/${imageType}`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
				responseType: 'blob',
			},
		);

		return URL.createObjectURL(response.data);
	},

	async createElection(data: CreateElectionData): Promise<Election> {
		const response = await axios.post(`${API_BASE_URL}/admin/elections`, data);
		return response.data;
	},

	async getAllElections(): Promise<Election[]> {
		const response = await axios.get(`${API_BASE_URL}/admin/elections`);
		return response.data;
	},

	async updateElection(id: number, data: Partial<Election>): Promise<Election> {
		const response = await axios.patch(`${API_BASE_URL}/admin/elections/${id}`, data);
		return response.data;
	},

	async deleteElection(id: number): Promise<void> {
		await axios.delete(`${API_BASE_URL}/admin/elections/${id}`);
	},
};
