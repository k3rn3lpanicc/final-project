export interface Request {
  id: string;
  fullName: string;
  passportNumber: string;
  dateOfBirth: string;
  nationality: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto_rejected';
  voterId: string;
  secretX: string;
  hashXp: string;
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

export interface CreateElectionData {
  name: string;
  description: string;
  options: string[];
}
