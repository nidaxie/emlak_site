import { ApiRequestError, queryString, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type {
  AdminAgentApplication,
  AdminAgentApplicationListItem,
  AdminAgentApplicationListQuery,
  AgentApplicationApproval,
  AgentApplicationDocument,
  AgentApplicationRejection,
  PaginatedResponse,
} from '@/types/api';

function assertApiModeForAdminApplications() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message: 'Bu özellik gerçek API bağlantısı gerektirir.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/admin/agent-applications',
    });
  }
}

export const adminAgentApplicationsService = {
  getApplications: (
    query: AdminAgentApplicationListQuery,
  ): Promise<PaginatedResponse<AdminAgentApplicationListItem>> => {
    assertApiModeForAdminApplications();
    return request<PaginatedResponse<AdminAgentApplicationListItem>>(
      `/admin/agent-applications${queryString(query)}`,
      {},
      { auth: true },
    );
  },

  getApplication: (id: string): Promise<AdminAgentApplication> => {
    assertApiModeForAdminApplications();
    return request<AdminAgentApplication>(
      `/admin/agent-applications/${id}`,
      {},
      { auth: true },
    );
  },

  getApplicationDocuments: (id: string): Promise<AgentApplicationDocument[]> => {
    assertApiModeForAdminApplications();
    return request<AgentApplicationDocument[]>(
      `/admin/agent-applications/${id}/documents`,
      {},
      { auth: true },
    );
  },

  getApplicationDocument: (id: string, documentId: string): Promise<Blob> => {
    assertApiModeForAdminApplications();
    return request<Blob>(
      `/admin/agent-applications/${id}/documents/${documentId}`,
      {},
      { auth: true },
    );
  },

  approveApplication: (id: string): Promise<AgentApplicationApproval> => {
    assertApiModeForAdminApplications();
    return request<AgentApplicationApproval>(
      `/admin/agent-applications/${id}/approve`,
      {
        method: 'POST',
      },
      { auth: true },
    );
  },

  rejectApplication: (
    id: string,
    reason: string,
  ): Promise<AgentApplicationRejection> => {
    assertApiModeForAdminApplications();
    return request<AgentApplicationRejection>(
      `/admin/agent-applications/${id}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      },
      { auth: true },
    );
  },
};
