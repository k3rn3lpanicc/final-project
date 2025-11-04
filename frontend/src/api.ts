import axios from 'axios';

const API_BASE_URL = 'https://votingbackend.emit-aut.ir';

export interface VoterRequest {
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

export interface SignatureData {
  signatureR8x: string;
  signatureR8y: string;
  signatureS: string;
  publicKeyX: string;
  publicKeyY: string;
}

export interface AdminPublicKey {
  publicKeyX: string;
  publicKeyY: string;
}

class VoterAPI {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async submitRegistration(formData: FormData): Promise<VoterRequest> {
    const response = await axios.post<VoterRequest>(
      `${this.baseURL}/voters/register`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  async getRequest(requestId: string): Promise<VoterRequest> {
    const response = await axios.get<VoterRequest>(
      `${this.baseURL}/voters/request/${requestId}`
    );
    return response.data;
  }

  async getSignature(requestId: string): Promise<SignatureData> {
    const response = await axios.get<SignatureData>(
      `${this.baseURL}/voters/signature/${requestId}`
    );
    return response.data;
  }

  async getAdminPublicKey(): Promise<AdminPublicKey> {
    const response = await axios.get<AdminPublicKey>(
      `${this.baseURL}/admin/public-key`
    );
    return response.data;
  }

  async getActiveElections(): Promise<Election[]> {
    const response = await axios.get<Election[]>(
      `${this.baseURL}/elections`
    );
    return response.data;
  }
}

export const voterAPI = new VoterAPI();
