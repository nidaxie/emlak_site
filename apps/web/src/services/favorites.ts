import { ApiRequestError, queryString, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type {
  FavoriteListResponse,
  FavoriteMutationResponse,
  FavoriteRemovalResponse,
} from '@/types/api';

function assertApiModeForFavorites() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message: 'Bu özellik gerçek API bağlantısı gerektirir.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/favorites',
    });
  }
}

export const favoritesService = {
  getFavorites: (page = 1, limit = 20): Promise<FavoriteListResponse> => {
    assertApiModeForFavorites();
    return request<FavoriteListResponse>(
      `/favorites${queryString({ page, limit })}`,
      {},
      { auth: true },
    );
  },

  addFavorite: (propertyId: string): Promise<FavoriteMutationResponse> => {
    assertApiModeForFavorites();
    return request<FavoriteMutationResponse>(
      `/favorites/${propertyId}`,
      { method: 'POST' },
      { auth: true },
    );
  },

  removeFavorite: (propertyId: string): Promise<FavoriteRemovalResponse> => {
    assertApiModeForFavorites();
    return request<FavoriteRemovalResponse>(
      `/favorites/${propertyId}`,
      { method: 'DELETE' },
      { auth: true },
    );
  },

  // Backward-compatible aliases used in api.ts
  list: (page = 1, limit = 20): Promise<FavoriteListResponse> =>
    favoritesService.getFavorites(page, limit),
  add: (propertyId: string): Promise<FavoriteMutationResponse> =>
    favoritesService.addFavorite(propertyId),
  remove: (propertyId: string): Promise<FavoriteRemovalResponse> =>
    favoritesService.removeFavorite(propertyId),
};
