import { apiRequest, apiUpload } from '@/services/api-client';

export type UploadedImage = {
  id: string;
  url: string | null;
  sortOrder: number;
  isCover: boolean;
  createdAt: string;
};

export function uploadPropertyImage(
  accessToken: string,
  propertyId: string,
  file: Blob,
  fileName: string,
) {
  const form = new FormData();
  form.set('file', file, fileName);

  return apiUpload<UploadedImage>(
    `/properties/${propertyId}/images`,
    form,
    accessToken,
  );
}

export function orderPropertyImages(
  accessToken: string,
  propertyId: string,
  imageIds: string[],
) {
  return apiRequest<{ imageIds: string[] }>(
    `/properties/${propertyId}/images/order`,
    { method: 'PATCH', accessToken, body: { imageIds } },
  );
}

export function makePropertyCover(
  accessToken: string,
  propertyId: string,
  imageId: string,
) {
  return apiRequest<{ id: string; isCover: boolean }>(
    `/properties/${propertyId}/images/${imageId}/cover`,
    { method: 'PATCH', accessToken },
  );
}

export function deletePropertyImage(
  accessToken: string,
  propertyId: string,
  imageId: string,
) {
  return apiRequest<{ id: string }>(
    `/properties/${propertyId}/images/${imageId}`,
    { method: 'DELETE', accessToken },
  );
}

export function adminDeletePropertyImage(
  accessToken: string,
  propertyId: string,
  imageId: string,
) {
  return apiRequest<{ id: string }>(
    `/admin/properties/${propertyId}/images/${imageId}`,
    { method: 'DELETE', accessToken },
  );
}
