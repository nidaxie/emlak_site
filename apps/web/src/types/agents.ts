export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type AgentApplicationInput = {
  companyName: string;
  authorizedFirstName: string;
  authorizedLastName: string;
  phone: string;
  email: string;
  taxNumber: string;
  city: string;
  district: string;
  address: string;
  description?: string;
};

export type AgentApplication = {
  id: string;
  status: ApplicationStatus;
  companyName: string;
  authorizedFirstName: string;
  authorizedLastName: string;
  phone: string;
  email: string;
  taxNumber: string;
  city: string;
  district: string;
  address: string;
  description: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicAgentProfile = {
  slug: string;
  companyName: string;
  phone: string;
  email: string;
  city: string;
  district: string;
  description: string | null;
  logoUrl: string | null;
};

export type AgentProfile = PublicAgentProfile & {
  id: string;
  taxNumber: string;
  address: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpdateAgentProfileInput = {
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  description?: string;
};
