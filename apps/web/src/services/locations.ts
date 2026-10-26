import { apiRequest } from '@/services/api-client';

export type City = { id: string; name: string; code: string | null };
export type District = { id: string; cityId: string; name: string };
export type Neighborhood = { id: string; districtId: string; name: string };

export function getCities() {
  return apiRequest<City[]>('/locations/cities');
}

export function getDistricts(cityId: string) {
  return apiRequest<District[]>(`/locations/cities/${cityId}/districts`);
}

export function getNeighborhoods(districtId: string) {
  return apiRequest<Neighborhood[]>(
    `/locations/districts/${districtId}/neighborhoods`,
  );
}
