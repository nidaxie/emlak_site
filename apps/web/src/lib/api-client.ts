import type { ApiError } from '@/types/api';

const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api/v1' : '');

if (!rawBaseUrl) {
  throw new Error('VITE_API_BASE_URL ortam değişkeni tanımlanmalıdır.');
}

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
export const API_ORIGIN = new URL(
  API_BASE_URL,
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001',
).origin;

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let refreshedHandler: ((user: unknown) => void) | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function setRefreshedHandler(handler: ((user: unknown) => void) | null) {
  refreshedHandler = handler;
}

export function getRefreshedHandler() {
  return refreshedHandler;
}

export function fileUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export class ApiRequestError extends Error {
  status: number;
  payload?: ApiError;
  constructor(status: number, payload?: ApiError) {
    const localized: Record<number, string> = {
      400: 'Bilgiler kontrol edilemedi. Lütfen alanları ve seçimleri gözden geçirin.',
      401: 'Oturum açılamadı veya oturum süresi doldu.',
      403: 'Bu işlem için yetkiniz bulunmuyor.',
      404: 'İstenen kayıt bulunamadı veya artık görüntülenemiyor.',
      409: 'Bu işlem mevcut kayıt veya durumla çakışıyor.',
      413: 'Dosya boyutu izin verilen sınırı aşıyor.',
      415: 'Bu dosya türü desteklenmiyor.',
      429: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.',
      500: 'Sunucu tarafında bir sorun oluştu. Lütfen daha sonra tekrar deneyin.',
      503: 'Hizmet şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
    };
    const message =
      localized[status] ||
      (Array.isArray(payload?.message)
        ? payload.message.join(' · ')
        : payload?.message) ||
      'Bir sorun oluştu. Lütfen tekrar deneyin.';
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean | 'optional'; retry?: boolean } = {},
): Promise<T> {
  const protectedCall = options.auth === true;
  const optionalBearer = options.auth === 'optional';
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

  const response = await fetch(
    `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`,
    { ...init, headers },
  );

  if (!response.ok) {
    let body: ApiError | undefined;
    try {
      body = await response.json();
    } catch {
      /* response may be a file stream or empty body */
    }
    if (
      response.status === 401 &&
      (protectedCall || (optionalBearer && !!accessToken))
    ) {
      accessToken = null;
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
