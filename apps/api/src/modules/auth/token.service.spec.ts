import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { Role } from '../../generated/prisma/enums';
import { TokenService } from './token.service';

describe('TokenService access version', () => {
  const secret = 'access-version-test-secret';
  const tokens = new TokenService({
    getOrThrow: (key: string) => {
      if (key === 'JWT_SECRET') {
        return secret;
      }

      if (key === 'JWT_REFRESH_SECRET') {
        return 'refresh-version-test-secret';
      }

      if (key === 'JWT_ACCESS_EXPIRES_IN' || key === 'JWT_REFRESH_EXPIRES_IN') {
        return '15m';
      }

      throw new Error(key);
    },
  } as unknown as ConfigService);

  it('treats an access token without ver as version 0', () => {
    const token = sign({ sub: 'user-1', role: Role.USER }, secret, {
      expiresIn: '15m',
    });

    expect(tokens.verifyAccess(token)).toEqual({
      sub: 'user-1',
      role: Role.USER,
      ver: 0,
    });
  });

  it('keeps an integer ver claim', () => {
    const token = tokens.signAccess({
      sub: 'user-1',
      role: Role.AGENT,
      ver: 2,
    });

    expect(tokens.verifyAccess(token).ver).toBe(2);
  });

  it('rejects a fractional ver claim', () => {
    const token = sign({ sub: 'user-1', role: Role.USER, ver: 1.5 }, secret, {
      expiresIn: '15m',
    });

    expect(() => tokens.verifyAccess(token)).toThrow(UnauthorizedException);
  });
});
