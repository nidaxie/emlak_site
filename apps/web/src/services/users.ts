import { apiRequest } from '@/services/api-client';
import type { PublicUser, UpdateProfileInput } from '@/types/auth';

export function getCurrentUser(accessToken: string) {
  return apiRequest<PublicUser>('/users/me', { accessToken });
}

export function updateProfile(accessToken: string, input: UpdateProfileInput) {
  return apiRequest<PublicUser>('/users/me', {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}
