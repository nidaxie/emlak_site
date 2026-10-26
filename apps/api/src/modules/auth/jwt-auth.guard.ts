import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthUser } from '../../common/auth/auth-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TokenService } from './token.service';

type RequestWithUser = {
  headers: { authorization?: string };
  user?: AuthUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = readBearer(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Unauthorized');
    }

    const claims = this.tokens.verifyAccess(token);
    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Unauthorized');
    }

    request.user = { id: user.id, role: user.role };
    return true;
  }
}

function readBearer(header: string | undefined) {
  if (!header) {
    return undefined;
  }

  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return undefined;
  }

  return token;
}
