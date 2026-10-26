import { ApiRequestError, queryString, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type {
  ActiveStatusResponse,
  AdminUser,
  AdminUserDetail,
  AdminUserListQuery,
  PaginatedResponse,
} from '@/types/api';

function assertApiModeForAdminUsers() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message: 'Bu özellik gerçek API bağlantısı gerektirir.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/admin/users',
    });
  }
}

export const adminUsersService = {
  getUsers: (
    query: AdminUserListQuery,
  ): Promise<PaginatedResponse<AdminUser>> => {
    assertApiModeForAdminUsers();
    return request<PaginatedResponse<AdminUser>>(
      `/admin/users${queryString(query)}`,
      {},
      { auth: true },
    );
  },

  getUser: (id: string): Promise<AdminUserDetail> => {
    assertApiModeForAdminUsers();
    return request<AdminUserDetail>(`/admin/users/${id}`, {}, { auth: true });
  },

  updateUserStatus: (
    id: string,
    isActive: boolean,
  ): Promise<ActiveStatusResponse> => {
    assertApiModeForAdminUsers();
    return request<ActiveStatusResponse>(
      `/admin/users/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      },
      { auth: true },
    );
  },
};
