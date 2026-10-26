import { ApiRequestError, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type { UpdateUserProfileRequest, UserProfile } from '@/types/api';

function assertApiModeForUsers() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message: 'Bu özellik gerçek API bağlantısı gerektirir.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/users/me',
    });
  }
}

export const usersService = {
  getMe: (): Promise<UserProfile> => {
    assertApiModeForUsers();
    return request<UserProfile>('/users/me', {}, { auth: true });
  },

  updateMe: (data: UpdateUserProfileRequest): Promise<UserProfile> => {
    assertApiModeForUsers();
    const payload: UpdateUserProfileRequest = {
      ...(data.firstName !== undefined ? { firstName: data.firstName.trim() } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
    };
    return request<UserProfile>(
      '/users/me',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      { auth: true },
    );
  },

  // Backward-compatible alias used in api.ts
  me: (): Promise<UserProfile> => usersService.getMe(),
};
