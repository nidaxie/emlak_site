import { apiRequest } from '@/services/api-client';
import type { PropertyPage, PublicProperty } from '@/types/properties';

export type Favorite = {
  propertyId: string;
  createdAt: string;
};

export function addFavorite(accessToken: string, propertyId: string) {
  return apiRequest<Favorite>(`/favorites/${propertyId}`, { accessToken });
}

export function removeFavorite(accessToken: string, propertyId: string) {
  return apiRequest<{ propertyId: string }>(`/favorites/${propertyId}`, {
    method: 'DELETE',
    accessToken,
  });
}

export function getFavorites(
  accessToken: string,
  query: { page?: number; limit?: number } = {},
) {
  return apiRequest<PropertyPage<PublicProperty>>(
    `/favorites${queryString(query)}`,
    { accessToken },
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
