import { apiRequest } from '@/services/api-client';
import type {
  Property,
  PropertyInput,
  PropertyPage,
  PropertyStatus,
  PublicProperty,
  PublicPropertyQuery,
} from '@/types/properties';

export function createProperty(accessToken: string, input: PropertyInput) {
  return apiRequest<Property>('/properties', { accessToken, body: input });
}

export function updateProperty(
  accessToken: string,
  id: string,
  input: Partial<PropertyInput>,
) {
  return apiRequest<Property>(`/properties/${id}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export function updatePropertyStatus(
  accessToken: string,
  id: string,
  status: PropertyStatus,
) {
  return apiRequest<Property>(`/properties/${id}/status`, {
    method: 'PATCH',
    accessToken,
    body: { status },
  });
}

export function deleteProperty(accessToken: string, id: string) {
  return apiRequest<{ id: string; deletedAt: string }>(`/properties/${id}`, {
    method: 'DELETE',
    accessToken,
  });
}

export function getMyProperties(
  accessToken: string,
  query: { status?: PropertyStatus; page?: number; limit?: number } = {},
) {
  return apiRequest<PropertyPage<Property>>(
    `/properties/me${queryString(query)}`,
    { accessToken },
  );
}

export function getMyProperty(accessToken: string, id: string) {
  return apiRequest<Property>(`/properties/me/${id}`, { accessToken });
}

export function getPublicProperties(
  query: PublicPropertyQuery = {},
  accessToken?: string,
) {
  return apiRequest<PropertyPage<PublicProperty>>(
    `/properties${queryString(query)}`,
    { accessToken },
  );
}

export function getPropertyDetail(id: string, accessToken?: string) {
  return apiRequest<PublicProperty>(`/properties/${id}`, { accessToken });
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
