import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, verify, type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { parseDurationMs } from '../../config/duration';
import { Role } from '../../generated/prisma/enums';

export type AccessTokenClaims = {
  sub: string;
  role: Role;
};

export type RefreshTokenClaims = {
  sub: string;
  sid: string;
};

@Injectable()
export class TokenService {
  constructor(private readonly config: ConfigService) {}

  accessTtlMs() {
    return this.ttl('JWT_ACCESS_EXPIRES_IN');
  }

  refreshTtlMs() {
    return this.ttl('JWT_REFRESH_EXPIRES_IN');
  }

  signAccess(claims: AccessTokenClaims) {
    return sign(
      { sub: claims.sub, role: claims.role },
      this.config.getOrThrow<string>('JWT_SECRET'),
      { expiresIn: this.expiresIn('JWT_ACCESS_EXPIRES_IN') },
    );
  }

  signRefresh(claims: RefreshTokenClaims) {
    return sign(
      { sub: claims.sub, sid: claims.sid },
      this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      { expiresIn: this.expiresIn('JWT_REFRESH_EXPIRES_IN') },
    );
  }

  verifyAccess(token: string): AccessTokenClaims {
    const payload = this.claims(
      this.readPayload(token, this.config.getOrThrow<string>('JWT_SECRET')),
    );

    if (typeof payload.sub !== 'string' || !isRole(payload.role)) {
      throw new UnauthorizedException('Unauthorized');
    }

    return { sub: payload.sub, role: payload.role };
  }

  verifyRefresh(token: string): RefreshTokenClaims {
    const payload = this.claims(
      this.readPayload(
        token,
        this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      ),
    );

    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw new UnauthorizedException('Unauthorized');
    }

    return { sub: payload.sub, sid: payload.sid };
  }

  private claims(payload: JwtPayload): Record<string, unknown> {
    const json: unknown = JSON.parse(JSON.stringify(payload)) as unknown;

    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      throw new UnauthorizedException('Unauthorized');
    }

    return json as Record<string, unknown>;
  }

  private ttl(key: string) {
    const value = parseDurationMs(this.config.getOrThrow<string>(key));

    if (value === null) {
      throw new Error(`Invalid duration for ${key}`);
    }

    return value;
  }

  private expiresIn(key: string): SignOptions['expiresIn'] {
    return this.config.getOrThrow<string>(key) as SignOptions['expiresIn'];
  }

  private readPayload(token: string, secret: string): JwtPayload {
    try {
      const payload = verify(token, secret);

      if (typeof payload !== 'object' || payload === null) {
        throw new UnauthorizedException('Unauthorized');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Unauthorized');
    }
  }
}

function isRole(value: unknown): value is Role {
  return value === Role.USER || value === Role.AGENT || value === Role.ADMIN;
}
