import type { Request } from 'express';

export function requestPath(request: Request): string {
  const raw = request.originalUrl || request.url;
  const path = raw.split('?')[0];

  return path || '/';
}
