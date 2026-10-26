import { apiRequest } from '@/services/api-client';

export type AdminUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: 'USER' | 'AGENT' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
};

export type AdminUserPage = {
  items: AdminUser[];
  page: number;
  limit: number;
  total: number;
};

export function adminGetUsers(
  accessToken: string,
  query: {
    role?: AdminUser['role'];
    isActive?: 'true' | 'false';
    email?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  return apiRequest<AdminUserPage>(`/admin/users${queryString(query)}`, {
    accessToken,
  });
}

export function adminGetUser(accessToken: string, id: string) {
  return apiRequest<AdminUser & { updatedAt: string }>(`/admin/users/${id}`, {
    accessToken,
  });
}

export function adminSetUserStatus(
  accessToken: string,
  id: string,
  isActive: boolean,
) {
  return apiRequest<{ id: string; isActive: boolean }>(
    `/admin/users/${id}/status`,
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
