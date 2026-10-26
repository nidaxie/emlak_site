import { ApiRequestError, queryString, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import { propertyImagesService } from '@/services/property-images';
import type {
  AdminProperty,
  AdminPropertyDetail,
  AdminPropertyListQuery,
  CreatePropertyRequest,
  DeletePropertyResponse,
  DeletedPropertyImageResponse,
  MyPropertyListQuery,
  OwnerPropertyDetail,
  PaginatedResponse,
  PropertyCard,
  PropertyCoverResponse,
  PropertyDetail,
  PropertyImageOrderResponse,
  PropertyRecord,
  PublicPropertyListQuery,
  UpdatePropertyRequest,
  UpdatePropertyStatusRequest,
  UploadedPropertyImage,
} from '@/types/api';

function assertApiModeForAgentProperties() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message: 'Bu özellik gerçek API bağlantısı gerektirir.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/properties',
    });
  }
}

export const propertiesService = {
  listPublic: (
    query: PublicPropertyListQuery,
  ): Promise<PaginatedResponse<PropertyCard>> =>
    request<PaginatedResponse<PropertyCard>>(
      `/properties${queryString(query)}`,
      {},
      { auth: 'optional' },
    ),

  getPublicDetail: (id: string): Promise<PropertyDetail> =>
    request<PropertyDetail>(`/properties/${id}`, {}, { auth: 'optional' }),

  getMyProperties: (
    query: MyPropertyListQuery,
  ): Promise<PaginatedResponse<PropertyRecord>> => {
    assertApiModeForAgentProperties();
    return request<PaginatedResponse<PropertyRecord>>(
      `/properties/me${queryString(query)}`,
      {},
      { auth: true },
    );
  },

  getMyProperty: (id: string): Promise<OwnerPropertyDetail> => {
    assertApiModeForAgentProperties();
    return request<OwnerPropertyDetail>(
      `/properties/me/${id}`,
      {},
      { auth: true },
    );
  },

  createProperty: (data: CreatePropertyRequest): Promise<PropertyRecord> => {
    assertApiModeForAgentProperties();
    return request<PropertyRecord>(
      '/properties',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      { auth: true },
    );
  },

  updateProperty: (
    id: string,
    data: UpdatePropertyRequest,
  ): Promise<PropertyRecord> => {
    assertApiModeForAgentProperties();
    return request<PropertyRecord>(
      `/properties/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      { auth: true },
    );
  },

  updatePropertyStatus: (
    id: string,
    data: UpdatePropertyStatusRequest,
  ): Promise<PropertyRecord> => {
    assertApiModeForAgentProperties();
    return request<PropertyRecord>(
      `/properties/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      { auth: true },
    );
  },

  deleteProperty: (id: string): Promise<DeletePropertyResponse> => {
    assertApiModeForAgentProperties();
    return request<DeletePropertyResponse>(
      `/properties/${id}`,
      {
        method: 'DELETE',
      },
      { auth: true },
    );
  },

  // Backward-compatible aliases used in api.ts
  list: (
    query: PublicPropertyListQuery,
  ): Promise<PaginatedResponse<PropertyCard>> =>
    propertiesService.listPublic(query),
  detail: (id: string): Promise<PropertyDetail> =>
    propertiesService.getPublicDetail(id),
  mine: (
    query: MyPropertyListQuery,
  ): Promise<PaginatedResponse<PropertyRecord>> =>
    propertiesService.getMyProperties(query),
  mineDetail: (id: string): Promise<OwnerPropertyDetail> =>
    propertiesService.getMyProperty(id),
  create: (data: CreatePropertyRequest): Promise<PropertyRecord> =>
    propertiesService.createProperty(data),
  update: (id: string, data: UpdatePropertyRequest): Promise<PropertyRecord> =>
    propertiesService.updateProperty(id, data),
  status: (
    id: string,
    data: UpdatePropertyStatusRequest,
  ): Promise<PropertyRecord> => propertiesService.updatePropertyStatus(id, data),
  remove: (id: string): Promise<DeletePropertyResponse> =>
    propertiesService.deleteProperty(id),
  uploadImage: (id: string, file: File): Promise<UploadedPropertyImage> =>
    propertyImagesService.uploadPropertyImage(id, file),
  orderImages: (
    id: string,
    imageIds: string[],
  ): Promise<PropertyImageOrderResponse> =>
    propertyImagesService.updateImageOrder(id, imageIds),
  coverImage: (id: string, imageId: string): Promise<PropertyCoverResponse> =>
    propertyImagesService.setCoverImage(id, imageId),
  deleteImage: (
    id: string,
    imageId: string,
  ): Promise<DeletedPropertyImageResponse> =>
    propertyImagesService.deletePropertyImage(id, imageId),
  adminList: (
    query: AdminPropertyListQuery,
  ): Promise<PaginatedResponse<AdminProperty>> =>
    request<PaginatedResponse<AdminProperty>>(
      `/admin/properties${queryString(query)}`,
      {},
      { auth: true },
    ),
  adminDetail: (id: string): Promise<AdminPropertyDetail> =>
    request<AdminPropertyDetail>(`/admin/properties/${id}`, {}, { auth: true }),
  moderate: (id: string, reason: string): Promise<PropertyRecord> =>
    request<PropertyRecord>(
      `/admin/properties/${id}/deactivate`,
      { method: 'PATCH', body: JSON.stringify({ reason }) },
      { auth: true },
    ),
  adminDelete: (id: string, reason: string): Promise<DeletePropertyResponse> =>
    request<DeletePropertyResponse>(
      `/admin/properties/${id}`,
      { method: 'DELETE', body: JSON.stringify({ reason }) },
      { auth: true },
    ),
  adminDeleteImage: (
    id: string,
    imageId: string,
  ): Promise<DeletedPropertyImageResponse> =>
    request<DeletedPropertyImageResponse>(
      `/admin/properties/${id}/images/${imageId}`,
      { method: 'DELETE' },
      { auth: true },
    ),
};
