import { apiRequest } from '@/services/api-client';
import type {
  Property,
  PropertyPage,
  PropertyStatus,
} from '@/types/properties';

export function adminGetProperties(
  accessToken: string,
  query: {
    status?: PropertyStatus;
    listingType?: 'SALE' | 'RENT';
    city?: string;
    deleted?: 'true' | 'false';
    page?: number;
    limit?: number;
  } = {},
) {
  return apiRequest<PropertyPage<Property>>(
    `/admin/properties${queryString(query)}`,
    { accessToken },
  );
}

export function adminGetProperty(accessToken: string, id: string) {
  return apiRequest<Property>(`/admin/properties/${id}`, { accessToken });
}

export function adminDeactivateProperty(
  accessToken: string,
  id: string,
  reason: string,
) {
  return apiRequest<Property>(`/admin/properties/${id}/deactivate`, {
    method: 'PATCH',
    accessToken,
    body: { reason },
  });
}

export function adminDeleteProperty(
  accessToken: string,
  id: string,
  reason: string,
) {
  return apiRequest<{ id: string; deletedAt: string }>(
    `/admin/properties/${id}`,
    { method: 'DELETE', accessToken, body: { reason } },
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
