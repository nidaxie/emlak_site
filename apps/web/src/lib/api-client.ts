import type {
  ApiError,
  AuthUser,
  LoginResponse,
  RefreshResponse,
} from '@/types/api';

const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api/v1' : '');

if (!rawBaseUrl) {
  throw new Error('VITE_API_BASE_URL ortam değişkeni tanımlanmalıdır.');
}

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
export const API_ORIGIN = new URL(
  API_BASE_URL,
  typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:3001',
).origin;

let accessToken: string | null = null;
let refreshFlight: Promise<RefreshResponse | null> | null = null;
let unauthorizedHandler: (() => void) | null = null;
let refreshedHandler: ((session: LoginResponse) => void) | null = null;
const tokenListeners = new Set<(token: string | null) => void>();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  tokenListeners.forEach((listener) => listener(token));
}

export function subscribeAccessToken(listener: (token: string | null) => void) {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function setRefreshedHandler(
  handler: ((session: LoginResponse) => void) | null,
) {
  refreshedHandler = handler;
}

export function fileUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function resolveErrorMessage(status: number, payload?: ApiError): string {
  const rawMessage = Array.isArray(payload?.message)
    ? payload.message.join(' · ')
    : payload?.message;

  if (status === 409 && rawMessage === 'Email already registered') {
    return 'Bu e-posta adresiyle kayıtlı bir hesap zaten bulunuyor.';
  }

  if (status === 401 && rawMessage === 'Invalid email or password') {
    return 'E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.';
  }

  const localized: Record<number, string> = {
    400: 'Bilgiler kontrol edilemedi. Lütfen alanları ve seçimleri gözden geçirin.',
    401: 'Oturum açılamadı veya oturum süresi doldu.',
    403: 'Bu işlem için yetkiniz bulunmuyor.',
    404: 'İstenen kayıt bulunamadı veya artık görüntülenemiyor.',
    409: 'Bu işlem mevcut kayıt veya durumla çakışıyor.',
    413: 'Dosya boyutu izin verilen sınırı aşıyor.',
    415: 'Bu dosya türü desteklenmiyor.',
    429: 'Çok fazla deneme yaptınız. Lütfen kısa süre sonra tekrar deneyin.',
    500: 'Sunucu tarafında bir sorun oluştu. Lütfen daha sonra tekrar deneyin.',
    503: 'Hizmet şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
  };

  return (
    localized[status] ||
    rawMessage ||
    'Bir sorun oluştu. Lütfen tekrar deneyin.'
  );
}

export class ApiRequestError extends Error {
  status: number;
  payload?: ApiError;
  constructor(status: number, payload?: ApiError) {
    super(resolveErrorMessage(status, payload));
    this.status = status;
    this.payload = payload;
  }
}

function isAuthEndpoint(path: string): boolean {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return (
    normalized === '/auth/login' ||
    normalized === '/auth/register' ||
    normalized === '/auth/refresh' ||
    normalized === '/auth/logout'
  );
}

/**
 * Single-flight session refresh using HttpOnly refresh_token cookie.
 * Never reads or accepts refresh token in JavaScript.
 */
export async function refreshSession(): Promise<RefreshResponse | null> {
  if (!refreshFlight) {
    refreshFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new ApiRequestError(response.status);
        }
        const body = (await response.json()) as RefreshResponse;
        setAccessToken(body.accessToken);
        refreshedHandler?.(body);
        return body;
      })
      .catch(() => {
        setAccessToken(null);
        unauthorizedHandler?.();
        return null;
      })
      .finally(() => {
        refreshFlight = null;
      });
  }

  return refreshFlight;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean | 'optional'; retry?: boolean } = {},
): Promise<T> {
  const protectedCall = options.auth === true;
  const optionalBearer = options.auth === 'optional';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(init.headers);

  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  if ((protectedCall || optionalBearer) && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const send = () =>
    fetch(`${API_BASE_URL}${normalizedPath}`, { ...init, headers });

  let response = await send();

  if (
    response.status === 401 &&
    (protectedCall || (optionalBearer && !!accessToken)) &&
    options.retry !== false &&
    !isAuthEndpoint(normalizedPath)
  ) {
    const refreshed = await refreshSession();
    if (refreshed?.accessToken) {
      headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
      response = await send();
    } else if (optionalBearer) {
      headers.delete('Authorization');
      response = await send();
    }
  }

  if (!response.ok) {
    let body: ApiError | undefined;
    try {
      body = (await response.json()) as ApiError;
    } catch {
      /* response may be a file stream or empty body */
    }
    if (
      response.status === 401 &&
      (protectedCall || (optionalBearer && !!accessToken)) &&
      !isAuthEndpoint(normalizedPath)
    ) {
      setAccessToken(null);
      unauthorizedHandler?.();
    }
    throw new ApiRequestError(response.status, body);
  }

  if (response.status === 204) return undefined as T;
  const type = response.headers.get('content-type') || '';
  return (
    type.includes('application/json') ? response.json() : response.blob()
  ) as Promise<T>;
}

export function queryString(params: object) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const result = query.toString();
  return result ? `?${result}` : '';
}

export function downloadPrivate(path: string) {
  return request<Blob>(path, {}, { auth: true }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'belge';
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

export type { AuthUser };
