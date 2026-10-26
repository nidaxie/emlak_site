import { ApiRequestError, refreshSession, request } from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  RefreshResponse,
  RegisterRequest,
  UserProfile,
} from '@/types/api';

function assertApiModeForAuth() {
  if (isMockDataEnabled) {
    throw new ApiRequestError(400, {
      statusCode: 400,
      message:
        'Demo veri modunda kimlik doğrulama işlemleri kullanılamaz. Gerçek API için VITE_DATA_MODE=api kullanın.',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: '/api/v1/auth',
    });
  }
}

export const authService = {
  register: (data: RegisterRequest): Promise<AuthUser> => {
    assertApiModeForAuth();
    return request<AuthUser>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      { retry: false },
    );
  },

  login: (data: LoginRequest): Promise<LoginResponse> => {
    assertApiModeForAuth();
    return request<LoginResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(data),
        credentials: 'include',
      },
      { retry: false },
    );
  },

  refresh: async (): Promise<RefreshResponse> => {
    assertApiModeForAuth();
    const session = await refreshSession();
    if (!session) {
      throw new ApiRequestError(401);
    }
    return session;
  },

  logout: (): Promise<LogoutResponse> => {
    assertApiModeForAuth();
    return request<LogoutResponse>(
      '/auth/logout',
      {
        method: 'POST',
        credentials: 'include',
      },
      { retry: false },
    );
  },

  getMe: (): Promise<UserProfile> => {
    assertApiModeForAuth();
    return request<UserProfile>('/users/me', {}, { auth: true });
  },
};
