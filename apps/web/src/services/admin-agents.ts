import { ApiRequestError, queryString, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type {
  ActiveStatusResponse,
  AdminAgent,
  AdminAgentListItem,
  AdminAgentListQuery,
  PaginatedResponse,
} from '@/types/api';

function assertApiModeForAdminAgents() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message: 'Bu özellik gerçek API bağlantısı gerektirir.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/admin/agents',
    });
  }
}

export const adminAgentsService = {
  getAgents: (
    query: AdminAgentListQuery,
  ): Promise<PaginatedResponse<AdminAgentListItem>> => {
    assertApiModeForAdminAgents();
    return request<PaginatedResponse<AdminAgentListItem>>(
      `/admin/agents${queryString(query)}`,
      {},
      { auth: true },
    );
  },

  getAgent: (id: string): Promise<AdminAgent> => {
    assertApiModeForAdminAgents();
    return request<AdminAgent>(`/admin/agents/${id}`, {}, { auth: true });
  },

  updateAgentStatus: (
    id: string,
    isActive: boolean,
  ): Promise<ActiveStatusResponse> => {
    assertApiModeForAdminAgents();
    return request<ActiveStatusResponse>(
      `/admin/agents/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      },
      { auth: true },
    );
  },
};
