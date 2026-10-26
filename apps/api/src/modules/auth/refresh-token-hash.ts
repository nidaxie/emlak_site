import { createHash, timingSafeEqual } from 'node:crypto';

export function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenHashesMatch(stored: string, presented: string) {
  const left = Buffer.from(stored, 'hex');
  const right = Buffer.from(presented, 'hex');

  if (left.length === 0 || left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
