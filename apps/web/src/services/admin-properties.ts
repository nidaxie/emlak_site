import { ApiRequestError, queryString, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type {
  AdminProperty,
  AdminPropertyDetail,
  AdminPropertyListQuery,
  DeletePropertyResponse,
  DeletedPropertyImageResponse,
  PaginatedResponse,
  PropertyRecord,
} from '@/types/api';

function assertApiModeForAdminProperties() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message: 'Bu özellik gerçek API bağlantısı gerektirir.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/admin/properties',
    });
  }
}

export const adminPropertiesService = {
  getProperties: (
    query: AdminPropertyListQuery,
  ): Promise<PaginatedResponse<AdminProperty>> => {
    assertApiModeForAdminProperties();
    return request<PaginatedResponse<AdminProperty>>(
      `/admin/properties${queryString(query)}`,
      {},
      { auth: true },
    );
  },

  getProperty: (id: string): Promise<AdminPropertyDetail> => {
    assertApiModeForAdminProperties();
    return request<AdminPropertyDetail>(
      `/admin/properties/${id}`,
      {},
      { auth: true },
    );
  },

  deactivateProperty: (id: string, reason: string): Promise<PropertyRecord> => {
    assertApiModeForAdminProperties();
    return request<PropertyRecord>(
      `/admin/properties/${id}/deactivate`,
      {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason.trim() }),
      },
      { auth: true },
    );
  },

  deletePropertyImage: (
    id: string,
    imageId: string,
  ): Promise<DeletedPropertyImageResponse> => {
    assertApiModeForAdminProperties();
    return request<DeletedPropertyImageResponse>(
      `/admin/properties/${id}/images/${imageId}`,
      {
        method: 'DELETE',
      },
      { auth: true },
    );
  },

  deleteProperty: (
    id: string,
    reason: string,
  ): Promise<DeletePropertyResponse> => {
    assertApiModeForAdminProperties();
    return request<DeletePropertyResponse>(
      `/admin/properties/${id}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ reason: reason.trim() }),
      },
      { auth: true },
    );
  },
};
