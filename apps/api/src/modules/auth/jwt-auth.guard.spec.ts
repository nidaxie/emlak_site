import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService } from './token.service';

describe('JwtAuthGuard', () => {
  const tokens = {
    verifyAccess: jest.fn(),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  const guard = new JwtAuthGuard(
    tokens as unknown as TokenService,
    prisma as unknown as PrismaService,
  );

  function contextFor(authorization?: string) {
    const request: { headers: { authorization?: string }; user?: unknown } = {
      headers: { authorization },
    };

    return {
      context: {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext,
      request,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects a missing token', async () => {
    const { context } = contextFor();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(tokens.verifyAccess).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    tokens.verifyAccess.mockImplementation(() => {
      throw new UnauthorizedException('Unauthorized');
    });
    const { context } = contextFor('Bearer bad-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an inactive user even when the token signature is valid', async () => {
    tokens.verifyAccess.mockReturnValue({ sub: 'user-1', role: Role.USER });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: Role.USER,
      isActive: false,
    });
    const { context } = contextFor('Bearer access-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('sets request.user from the current database role', async () => {
    tokens.verifyAccess.mockReturnValue({ sub: 'user-1', role: Role.USER });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: Role.AGENT,
      isActive: true,
    });
    const { context, request } = contextFor('Bearer access-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', role: Role.AGENT });
  });
});
