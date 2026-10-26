import { apiRequest } from '@/services/api-client';
import type {
  AuthResult,
  LoginInput,
  RegisterInput,
  PublicUser,
} from '@/types/auth';

export function register(input: RegisterInput) {
  return apiRequest<PublicUser>('/auth/register', {
    method: 'POST',
    body: input,
  });
}

export function login(input: LoginInput) {
  return apiRequest<AuthResult>('/auth/login', {
    method: 'POST',
    body: input,
  });
}

export function refreshSession() {
  return apiRequest<AuthResult>('/auth/refresh', {
    method: 'POST',
  });
}

export function logout() {
  return apiRequest<{ ok: true }>('/auth/logout', {
    method: 'POST',
  });
}
