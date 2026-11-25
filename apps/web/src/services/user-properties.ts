import { ApiRequestError, queryString, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type {
  CreatePropertyRequest,
  DeletePropertyResponse,
  DeletedPropertyImageResponse,
  MyPropertyListQuery,
  PaginatedResponse,
  PropertyCoverResponse,
  PropertyImageOrderResponse,
  UpdatePropertyRequest,
  UpdateUserPropertyStatusRequest,
  UploadedPropertyImage,
  UserPropertyDetail,
  UserPropertyRecord,
} from '@/types/api';

function assertApiMode() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message: 'Bu özellik gerçek API bağlantısı gerektirir.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/user-properties',
    });
  }
}

export const userPropertiesService = {
  createUserProperty: (
    data: CreatePropertyRequest,
  ): Promise<UserPropertyRecord> => {
    assertApiMode();
    return request<UserPropertyRecord>(
      '/user-properties',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      { auth: true },
    );
  },

  uploadUserPropertyImage: (
    propertyId: string,
    file: File,
  ): Promise<UploadedPropertyImage> => {
    assertApiMode();
    const body = new FormData();
    body.append('file', file);
    return request<UploadedPropertyImage>(
      `/user-properties/${propertyId}/images`,
      {
        method: 'POST',
        body,
      },
      { auth: true },
    );
  },

  updateUserPropertyImageOrder: (
    propertyId: string,
    imageIds: string[],
  ): Promise<PropertyImageOrderResponse> => {
    assertApiMode();
    return request<PropertyImageOrderResponse>(
      `/user-properties/${propertyId}/images/order`,
      {
        method: 'PATCH',
        body: JSON.stringify({ imageIds }),
      },
      { auth: true },
    );
  },

  setUserPropertyCover: (
    propertyId: string,
    imageId: string,
  ): Promise<PropertyCoverResponse> => {
    assertApiMode();
    return request<PropertyCoverResponse>(
      `/user-properties/${propertyId}/images/${imageId}/cover`,
      { method: 'PATCH' },
      { auth: true },
    );
  },

  deleteUserPropertyImage: (
    propertyId: string,
    imageId: string,
  ): Promise<DeletedPropertyImageResponse> => {
    assertApiMode();
    return request<DeletedPropertyImageResponse>(
      `/user-properties/${propertyId}/images/${imageId}`,
      { method: 'DELETE' },
      { auth: true },
    );
  },

  getMyUserProperties: (
    query: MyPropertyListQuery = {},
  ): Promise<PaginatedResponse<UserPropertyRecord>> => {
    assertApiMode();
    return request<PaginatedResponse<UserPropertyRecord>>(
      `/user-properties/me${queryString(query)}`,
      {},
      { auth: true },
    );
  },

  getMyUserProperty: (id: string): Promise<UserPropertyDetail> => {
    assertApiMode();
    return request<UserPropertyDetail>(
      `/user-properties/me/${id}`,
      {},
      { auth: true },
    );
  },

  updateUserProperty: (
    id: string,
    data: UpdatePropertyRequest,
  ): Promise<UserPropertyRecord> => {
    assertApiMode();
    return request<UserPropertyRecord>(
      `/user-properties/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      { auth: true },
    );
  },

  updateUserPropertyStatus: (
    id: string,
    data: UpdateUserPropertyStatusRequest,
  ): Promise<UserPropertyRecord> => {
    assertApiMode();
    return request<UserPropertyRecord>(
      `/user-properties/${id}/status`,
      { method: 'PATCH', body: JSON.stringify(data) },
      { auth: true },
    );
  },

  deleteUserProperty: (id: string): Promise<DeletePropertyResponse> => {
    assertApiMode();
    return request<DeletePropertyResponse>(
      `/user-properties/${id}`,
      { method: 'DELETE' },
      { auth: true },
    );
  },
};
