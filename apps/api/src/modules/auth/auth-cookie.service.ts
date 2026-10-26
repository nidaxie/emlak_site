import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

export const REFRESH_COOKIE = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}

  set(response: Response, token: string, maxAge: number) {
    response.cookie(REFRESH_COOKIE, token, {
      ...this.options(),
      maxAge,
    });
  }

  clear(response: Response) {
    response.clearCookie(REFRESH_COOKIE, this.options());
  }

  read(request: Request) {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[REFRESH_COOKIE];

    return typeof token === 'string' && token.length > 0 ? token : undefined;
  }

  private options() {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: this.config.getOrThrow<'lax' | 'strict' | 'none'>(
        'COOKIE_SAMESITE',
      ),
      path: REFRESH_COOKIE_PATH,
    };
  }
}
