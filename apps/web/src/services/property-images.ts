import { ApiRequestError, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type {
  DeletedPropertyImageResponse,
  PropertyCoverResponse,
  PropertyImageOrderResponse,
  UploadedPropertyImage,
} from '@/types/api';

function assertApiModeForPropertyImages() {
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

export const propertyImagesService = {
  uploadPropertyImage: (
    propertyId: string,
    file: File,
  ): Promise<UploadedPropertyImage> => {
    assertApiModeForPropertyImages();
    const body = new FormData();
    body.append('file', file);
    return request<UploadedPropertyImage>(
      `/properties/${propertyId}/images`,
      {
        method: 'POST',
        body,
      },
      { auth: true },
    );
  },

  uploadPropertyImages: async (
    propertyId: string,
    files: File[],
  ): Promise<UploadedPropertyImage[]> => {
    assertApiModeForPropertyImages();
    const uploaded: UploadedPropertyImage[] = [];
    for (const file of files) {
      const item = await propertyImagesService.uploadPropertyImage(
        propertyId,
        file,
      );
      uploaded.push(item);
    }
    return uploaded;
  },

  updateImageOrder: (
    propertyId: string,
    imageIds: string[],
  ): Promise<PropertyImageOrderResponse> => {
    assertApiModeForPropertyImages();
    return request<PropertyImageOrderResponse>(
      `/properties/${propertyId}/images/order`,
      {
        method: 'PATCH',
        body: JSON.stringify({ imageIds }),
      },
      { auth: true },
    );
  },

  setCoverImage: (
    propertyId: string,
    imageId: string,
  ): Promise<PropertyCoverResponse> => {
    assertApiModeForPropertyImages();
    return request<PropertyCoverResponse>(
      `/properties/${propertyId}/images/${imageId}/cover`,
      {
        method: 'PATCH',
      },
      { auth: true },
    );
  },

  deletePropertyImage: (
    propertyId: string,
    imageId: string,
  ): Promise<DeletedPropertyImageResponse> => {
    assertApiModeForPropertyImages();
    return request<DeletedPropertyImageResponse>(
      `/properties/${propertyId}/images/${imageId}`,
      {
        method: 'DELETE',
      },
      { auth: true },
    );
  },
};
