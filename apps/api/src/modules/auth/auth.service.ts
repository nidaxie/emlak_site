import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PublicUser, toPublicUser } from '../../common/auth/public-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Role } from '../../generated/prisma/enums';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { blankToNull, normalizeEmail } from './normalize';
import { PasswordService } from './password.service';
import {
  hashRefreshToken,
  refreshTokenHashesMatch,
} from './refresh-token-hash';
import { TokenService } from './token.service';

const invalidCredentials = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = normalizeEmail(dto.email);
    const passwordHash = await this.passwords.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: blankToNull(dto.firstName) ?? null,
          lastName: blankToNull(dto.lastName) ?? null,
          phone: blankToNull(dto.phone) ?? null,
          role: Role.USER,
          isActive: true,
        },
        select: publicUserSelect,
      });

      return toPublicUser(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordMatches = user
      ? await this.passwords.verify(user.passwordHash, dto.password)
      : false;

    if (!user) {
      await this.passwords.verifyDummy(dto.password);
    }

    if (!user || !passwordMatches || !user.isActive) {
      throw new UnauthorizedException(invalidCredentials);
    }

    const issued = this.issueRefresh(user.id);
    await this.prisma.authSession.create({
      data: {
        id: issued.sessionId,
        userId: user.id,
        refreshTokenHash: issued.refreshTokenHash,
        expiresAt: issued.expiresAt,
      },
    });

    return {
      user: toPublicUser(user),
      accessToken: this.tokens.signAccess({ sub: user.id, role: user.role }),
      refreshToken: issued.refreshToken,
    };
  }

  async refresh(refreshToken: string | undefined) {
    const current = await this.readActiveSession(refreshToken);
    const issued = this.issueRefresh(current.user.id);

    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.authSession.updateMany({
        where: { id: current.session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Unauthorized');
      }

      await tx.authSession.create({
        data: {
          id: issued.sessionId,
          userId: current.user.id,
          refreshTokenHash: issued.refreshTokenHash,
          expiresAt: issued.expiresAt,
        },
      });
    });

    return {
      user: toPublicUser(current.user),
      accessToken: this.tokens.signAccess({
        sub: current.user.id,
        role: current.user.role,
      }),
      refreshToken: issued.refreshToken,
    };
  }

  async logout(refreshToken: string | undefined) {
    const current = await this.readActiveSession(refreshToken);

    await this.prisma.authSession.updateMany({
      where: { id: current.session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private issueRefresh(userId: string) {
    const sessionId = randomUUID();
    const refreshToken = this.tokens.signRefresh({
      sub: userId,
      sid: sessionId,
    });

    return {
      sessionId,
      refreshToken,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + this.tokens.refreshTtlMs()),
    };
  }

  private async readActiveSession(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    const claims = this.tokens.verifyRefresh(refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });
    const presentedHash = hashRefreshToken(refreshToken);

    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      !refreshTokenHashesMatch(session.refreshTokenHash, presentedHash) ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException('Unauthorized');
    }

    return { session, user: session.user };
  }
}

const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
