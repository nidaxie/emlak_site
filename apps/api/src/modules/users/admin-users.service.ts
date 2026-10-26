import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive === undefined
        ? {}
        : { isActive: query.isActive === 'true' }),
      ...(query.email
        ? { email: { contains: query.email, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: userSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        updatedAt: true,
        agentProfile: {
          select: {
            id: true,
            slug: true,
            companyName: true,
            isActive: true,
            city: true,
            district: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async setStatus(actorId: string, userId: string, isActive: boolean) {
    if (actorId === userId && !isActive) {
      throw new ConflictException('Admin cannot deactivate their own account');
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true },
      });

      if (!current) {
        throw new NotFoundException('User not found');
      }

      if (current.isActive === isActive) {
        return { id: current.id, isActive: current.isActive };
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { isActive },
        select: { id: true, isActive: true },
      });
      await this.audit.record(tx, {
        actorUserId: actorId,
        action: isActive
          ? AuditAction.USER_ACTIVATED
          : AuditAction.USER_DEACTIVATED,
        entityType: 'USER',
        entityId: userId,
      });

      return updated;
    });
  }
}
