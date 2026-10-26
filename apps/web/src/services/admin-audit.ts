import { ApiRequestError, queryString, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type {
  AuditLog,
  AuditLogListQuery,
  PaginatedResponse,
} from '@/types/api';

function assertApiModeForAdminAudit() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message: 'Bu özellik gerçek API bağlantısı gerektirir.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/admin/audit-logs',
    });
  }
}

export const adminAuditService = {
  getAuditLogs: (
    query: AuditLogListQuery,
  ): Promise<PaginatedResponse<AuditLog>> => {
    assertApiModeForAdminAudit();
    return request<PaginatedResponse<AuditLog>>(
      `/admin/audit-logs${queryString(query)}`,
      {},
      { auth: true },
    );
  },
};
