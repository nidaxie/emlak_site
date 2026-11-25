import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  AuditAction,
  PropertySellerType,
  PropertyStatus,
  Role,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicPropertyWhere } from '../properties/properties.service';
import {
  createdAtFilter,
  parseCreatedBound,
  registrationPoints,
  userSearchWhere,
  wouldRemoveLastAdmin,
} from './admin-user-query';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserSummaryQueryDto } from './dto/user-summary-query.dto';

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

const listProfileSelect = {
  id: true,
  companyName: true,
  isActive: true,
  _count: {
    select: {
      properties: { where: { deletedAt: null } },
    },
  },
} as const;

const individualCount = {
  where: {
    deletedAt: null,
    sellerType: PropertySellerType.INDIVIDUAL,
  },
} as const;

const applicationPreviewSelect = {
  id: true,
  companyName: true,
  status: true,
  createdAt: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
} as const;

const applicationPreviewLimit = 20;
const managementEventLimit = 10;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          ...userSelect,
          _count: { select: { ownedProperties: individualCount } },
          agentProfile: { select: listProfileSelect },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map(presentListUser),
      page,
      limit,
      total,
    };
  }

  async summary(query: UserSummaryQueryDto) {
    const grouped = await this.prisma.user.groupBy({
      by: ['role', 'isActive'],
      _count: { _all: true },
    });
    const counts = presentPopulation(grouped);
    const series = await this.registrationSeries(query);

    return {
      ...counts,
      registrations: series,
    };
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

    const individualWhere = {
      ownerUserId: id,
      sellerType: PropertySellerType.INDIVIDUAL,
      deletedAt: null,
    };
    const agentWhere = user.agentProfile
      ? {
          agentProfileId: user.agentProfile.id,
          sellerType: PropertySellerType.AGENT,
          deletedAt: null,
        }
      : null;
    const [
      individualListings,
      agentListings,
      applications,
      applicationTotal,
      managementEvents,
    ] = await Promise.all([
      this.listingSummary(individualWhere, {
        ...publicPropertyWhere,
        ownerUserId: id,
        sellerType: PropertySellerType.INDIVIDUAL,
      }),
      agentWhere
        ? this.listingSummary(agentWhere, {
            ...publicPropertyWhere,
            agentProfileId: user.agentProfile!.id,
            sellerType: PropertySellerType.AGENT,
          })
        : Promise.resolve(null),
      this.prisma.agentApplication.findMany({
        where: { userId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: applicationPreviewLimit,
        select: applicationPreviewSelect,
      }),
      this.prisma.agentApplication.count({ where: { userId: id } }),
      this.audit.list({
        entityType: 'USER',
        entityId: id,
        page: 1,
        limit: managementEventLimit,
      }),
    ]);

    return {
      ...user,
      individualListings,
      agentListings,
      applications: {
        items: applications,
        total: applicationTotal,
      },
      managementEvents,
    };
  }

  async setStatus(actorId: string, userId: string, isActive: boolean) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(321001, 1)`;
      const actor = await tx.user.findUnique({
        where: { id: actorId },
        select: { id: true, role: true, isActive: true },
      });

      if (!actor || !actor.isActive || actor.role !== Role.ADMIN) {
        throw new ForbiddenException('Forbidden');
      }

      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isActive: true },
      });

      if (!current) {
        throw new NotFoundException('User not found');
      }

      if (actorId === userId && !isActive) {
        throw new ConflictException(
          'Admin cannot deactivate their own account',
        );
      }

      if (current.isActive === isActive) {
        return { id: current.id, isActive: current.isActive };
      }

      const activeAdminCount = await tx.user.count({
        where: { role: Role.ADMIN, isActive: true },
      });

      if (
        wouldRemoveLastAdmin({
          targetRole: current.role,
          targetIsActive: current.isActive,
          nextIsActive: isActive,
          activeAdminCount,
        })
      ) {
        throw new ConflictException('At least one active admin must remain');
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          isActive,
          ...(isActive ? {} : { tokenVersion: { increment: 1 } }),
        },
        select: { id: true, isActive: true },
      });

      if (!isActive) {
        await tx.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await this.audit.record(tx, {
        actorUserId: actorId,
        action: isActive
          ? AuditAction.USER_ACTIVATED
          : AuditAction.USER_DEACTIVATED,
        entityType: 'USER',
        entityId: userId,
        metadata: {
          previousIsActive: current.isActive,
          nextIsActive: isActive,
        },
      });

      return updated;
    });
  }

  private async registrationSeries(query: UserSummaryQueryDto) {
    if (!query.createdFrom && !query.createdTo && !query.bucket) {
      return null;
    }

    if (!query.createdFrom || !query.createdTo || !query.bucket) {
      throw new BadRequestException(
        'createdFrom, createdTo, and bucket are required together',
      );
    }

    const from = parseCreatedBound(query.createdFrom, 'start');
    const to = parseCreatedBound(query.createdTo, 'end');

    if (!from || !to) {
      throw new BadRequestException('Invalid date');
    }

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('createdFrom must not be after createdTo');
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ bucket: string; count: number }>
    >`
      SELECT to_char(
               date_trunc(${query.bucket}::text, "createdAt"),
               'YYYY-MM-DD"T"HH24:MI:SS"Z"'
             ) AS bucket,
             COUNT(*)::int AS count
      FROM users
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY 1
      ORDER BY 1
    `;
    const points = registrationPoints(from, to, query.bucket, rows);

    if (!points) {
      throw new BadRequestException(
        query.bucket === 'day'
          ? 'Day range cannot exceed 366 days'
          : 'Month range cannot exceed 36 months',
      );
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      bucket: query.bucket,
      total: points.reduce((sum, point) => sum + point.count, 0),
      points,
    };
  }

  private where(query: ListUsersQueryDto): Prisma.UserWhereInput {
    const createdFrom = query.createdFrom
      ? parseCreatedBound(query.createdFrom, 'start')
      : null;
    const createdTo = query.createdTo
      ? parseCreatedBound(query.createdTo, 'end')
      : null;

    if (
      (query.createdFrom && !createdFrom) ||
      (query.createdTo && !createdTo)
    ) {
      throw new BadRequestException('Invalid date');
    }

    if (
      createdFrom &&
      createdTo &&
      createdFrom.getTime() > createdTo.getTime()
    ) {
      throw new BadRequestException('createdFrom must not be after createdTo');
    }

    const createdAt = createdAtFilter(query.createdFrom, query.createdTo);

    return {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive === undefined
        ? {}
        : { isActive: query.isActive === 'true' }),
      ...(userSearchWhere(query.email) ?? {}),
      ...(createdAt ? { createdAt } : {}),
    };
  }

  private async listingSummary(
    where: Prisma.PropertyWhereInput,
    publiclyVisibleWhere: Prisma.PropertyWhereInput,
  ) {
    const [grouped, publiclyVisible] = await Promise.all([
      this.prisma.property.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.property.count({ where: publiclyVisibleWhere }),
    ]);
    const countOf = (status: PropertyStatus) =>
      grouped.find((row) => row.status === status)?._count._all ?? 0;
    const active = countOf(PropertyStatus.ACTIVE);
    const inactive = countOf(PropertyStatus.INACTIVE);
    const sold = countOf(PropertyStatus.SOLD);
    const rented = countOf(PropertyStatus.RENTED);

    return {
      total: active + inactive + sold + rented,
      active,
      inactive,
      sold,
      rented,
      publiclyVisible,
    };
  }
}

function presentListUser(row: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  _count: { ownedProperties: number };
  agentProfile: {
    id: string;
    companyName: string;
    isActive: boolean;
    _count: { properties: number };
  } | null;
}) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt,
    individualListingCount: row._count.ownedProperties,
    agentListingCount: row.agentProfile?._count.properties ?? 0,
    agentProfile: row.agentProfile
      ? {
          id: row.agentProfile.id,
          companyName: row.agentProfile.companyName,
          isActive: row.agentProfile.isActive,
        }
      : null,
  };
}

function emptyRoleCount() {
  return { total: 0, active: 0, inactive: 0 };
}

function presentPopulation(
  rows: Array<{
    role: Role;
    isActive: boolean;
    _count: { _all: number };
  }>,
) {
  const roles = {
    USER: emptyRoleCount(),
    AGENT: emptyRoleCount(),
    ADMIN: emptyRoleCount(),
  };

  for (const row of rows) {
    const role = roles[row.role];
    const count = row._count._all;

    role.total += count;

    if (row.isActive) {
      role.active += count;
    } else {
      role.inactive += count;
    }
  }

  return {
    total: roles.USER.total + roles.AGENT.total + roles.ADMIN.total,
    active: roles.USER.active + roles.AGENT.active + roles.ADMIN.active,
    inactive: roles.USER.inactive + roles.AGENT.inactive + roles.ADMIN.inactive,
    roles,
  };
}
