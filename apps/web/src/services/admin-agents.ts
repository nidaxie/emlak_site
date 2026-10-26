import { apiRequest } from '@/services/api-client';

export type AdminAgent = {
  id: string;
  slug: string;
  companyName: string;
  city: string;
  district: string;
  isActive: boolean;
  createdAt: string;
};

export type AdminAgentPage = {
  items: AdminAgent[];
  page: number;
  limit: number;
  total: number;
};

export function adminGetAgents(
  accessToken: string,
  query: {
    isActive?: 'true' | 'false';
    companyName?: string;
    city?: string;
    district?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  return apiRequest<AdminAgentPage>(`/admin/agents${queryString(query)}`, {
    accessToken,
  });
}

export function adminGetAgent(accessToken: string, id: string) {
  return apiRequest<AdminAgent>(`/admin/agents/${id}`, { accessToken });
}

export function adminSetAgentStatus(
  accessToken: string,
  id: string,
  isActive: boolean,
) {
  return apiRequest<{ id: string; isActive: boolean }>(
    `/admin/agents/${id}/status`,
    { method: 'PATCH', accessToken, body: { isActive } },
  );
}

function queryString(query: object) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const text = params.toString();
  return text ? `?${text}` : '';
}
