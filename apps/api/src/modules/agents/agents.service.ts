import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  ApplicationStatus,
  AuditAction,
  FileCategory,
  PropertySellerType,
  Role,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicPropertyWhere } from '../properties/properties.service';
import { lockActiveAgent, lockAgentProfile } from './active-agent';
import {
  agentListWhere,
  applyListingBreakdown,
  emptyListingCounts,
  emptyListingDistribution,
  listingCountsFromGroups,
  portfoliosByProfile,
  presentCityDistribution,
  presentProfileAccounts,
} from './admin-agent-query';
import { blankToNull } from '../auth/normalize';
import { fileRules } from '../storage/file-policy';
import {
  adminAgentLogoUrl,
  agentOwnedLogoUrl,
  publicFileUrl,
} from '../storage/public-file-url';
import { StorageService } from '../storage/storage.service';
import {
  parseCreatedBound,
  registrationPoints,
} from '../users/admin-user-query';
import { AgentSummaryQueryDto } from './dto/agent-summary-query.dto';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { UpdateAgentProfileDto } from './dto/update-agent-profile.dto';

const managementEventLimit = 10;
const logoMimeTypes = new Set(fileRules[FileCategory.AGENT_LOGO].mimeTypes);
const professionalPropertyWhere = {
  sellerType: PropertySellerType.AGENT,
  deletedAt: null,
} satisfies Prisma.PropertyWhereInput;

const publicAgentSelect = {
  slug: true,
  companyName: true,
  phone: true,
  email: true,
  city: true,
  district: true,
  description: true,
  logoFileId: true,
} as const;

const selfAgentSelect = {
  id: true,
  slug: true,
  companyName: true,
  phone: true,
  email: true,
  taxNumber: true,
  city: true,
  district: true,
  address: true,
  description: true,
  logoFileId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const adminUserSelect = {
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
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async getPublicBySlug(slug: string) {
    const profile = await this.prisma.agentProfile.findFirst({
      where: { slug, isActive: true, user: { isActive: true } },
      select: publicAgentSelect,
    });

    if (!profile) {
      throw new NotFoundException('Agent profile not found');
    }

    return withLogo(profile);
  }

  async getMine(userId: string) {
    const profile = await this.prisma.agentProfile.findUnique({
      where: { userId },
      select: selfAgentSelect,
    });

    if (!profile) {
      throw new NotFoundException('Agent profile not found');
    }

    return withLogo(profile, agentOwnedLogoUrl);
  }

  async openOwnedLogo(userId: string, fileId: string) {
    const profile = await this.prisma.agentProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        logoFileId: true,
        user: { select: { role: true, isActive: true } },
      },
    });

    if (!profile || profile.user.role !== Role.AGENT) {
      throw new ForbiddenException('Agent profile not found');
    }

    if (!profile.user.isActive) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (profile.logoFileId !== fileId) {
      throw new NotFoundException('File not found');
    }

    const file = await this.prisma.storedFile.findFirst({
      where: {
        id: fileId,
        deletedAt: null,
        category: FileCategory.AGENT_LOGO,
      },
      select: { storageKey: true, mimeType: true, originalName: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return {
      stream: await this.storage.open(file.storageKey),
      mimeType: file.mimeType,
      originalName: file.originalName,
    };
  }

  async updateMine(userId: string, dto: UpdateAgentProfileDto) {
    const data = {
      ...(dto.companyName !== undefined
        ? { companyName: dto.companyName }
        : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.description !== undefined
        ? { description: blankToNull(dto.description) }
        : {}),
    };

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await lockActiveAgent(tx, userId);

      return tx.agentProfile.update({
        where: { userId },
        data,
        select: selfAgentSelect,
      });
    });

    return withLogo(updated, agentOwnedLogoUrl);
  }

  async uploadLogo(
    userId: string,
    file: { buffer: Buffer; originalname?: string },
  ) {
    await this.prisma.$transaction((tx) => lockActiveAgent(tx, userId));
    const profile = await this.prisma.agentProfile.findUnique({
      where: { userId },
      select: { id: true, logoFileId: true },
    });

    if (!profile) {
      throw new NotFoundException('Agent profile not found');
    }

    const saved = await this.storage.save({
      category: FileCategory.AGENT_LOGO,
      ownerId: profile.id,
      originalName: file.originalname ?? 'logo',
      bytes: file.buffer,
    });

    try {
      const previousKey = await this.prisma.$transaction(async (tx) => {
        await lockActiveAgent(tx, userId);
        const current = await tx.agentProfile.findUnique({
          where: { id: profile.id },
          select: { logoFile: { select: { id: true, storageKey: true } } },
        });
        await tx.agentProfile.update({
          where: { id: profile.id },
          data: { logoFileId: saved.id },
        });

        if (!current?.logoFile) {
          return null;
        }

        await tx.storedFile.update({
          where: { id: current.logoFile.id },
          data: { deletedAt: new Date() },
        });

        return current.logoFile.storageKey;
      });

      if (previousKey) {
        await this.storage.discard(previousKey);
      }

      return { logoUrl: publicFileUrl(saved.id) };
    } catch (error) {
      await this.storage.discard(saved.storageKey);
      await this.prisma.storedFile
        .update({ where: { id: saved.id }, data: { deletedAt: new Date() } })
        .catch(() => undefined);
      throw error;
    }
  }

  async listForAdmin(query: ListAgentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = agentListWhere(query);
    const [rows, total] = await Promise.all([
      this.prisma.agentProfile.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          companyName: true,
          phone: true,
          email: true,
          city: true,
          district: true,
          isActive: true,
          createdAt: true,
          logoFileId: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.agentProfile.count({ where }),
    ]);
    const portfolios = await this.portfoliosFor(rows.map((row) => row.id));

    return {
      items: rows.map((row) => {
        const { logoFileId, ...item } = row;

        return {
          ...item,
          logo: adminLogo(row.id, logoFileId),
          listingSummary: portfolios.get(row.id) ?? emptyListingCounts(),
        };
      }),
      page,
      limit,
      total,
    };
  }

  async summary(query: AgentSummaryQueryDto) {
    const [matrix, listingSummary, cities, created] = await Promise.all([
      this.profileMatrix(),
      this.professionalPortfolio(),
      this.cityDistribution(),
      this.createdSeries(query),
    ]);

    return {
      ...presentProfileAccounts(matrix),
      listingSummary,
      cities,
      created,
    };
  }

  async getForAdmin(id: string) {
    const profile = await this.prisma.agentProfile.findUnique({
      where: { id },
      select: {
        ...selfAgentSelect,
        userId: true,
        user: { select: adminUserSelect },
      },
    });

    if (!profile) {
      throw new NotFoundException('Agent profile not found');
    }

    const [listingSummary, approvedTotal, managementEvents] = await Promise.all(
      [
        this.portfolioFor(profile.id),
        this.prisma.agentApplication.count({
          where: {
            userId: profile.userId,
            status: ApplicationStatus.APPROVED,
          },
        }),
        this.audit.list({
          entityType: 'AGENT_PROFILE',
          entityId: id,
          page: 1,
          limit: managementEventLimit,
        }),
      ],
    );
    const presented = withLogo(profile);

    return {
      ...presented,
      logo: adminLogo(profile.id, profile.logoFileId),
      listingSummary,
      approvedApplications: {
        userId: profile.userId,
        status: ApplicationStatus.APPROVED,
        total: approvedTotal,
        listPath: `/api/v1/admin/agent-applications?userId=${profile.userId}&status=APPROVED`,
      },
      propertiesPath: `/api/v1/admin/properties?agentUserId=${profile.userId}`,
      managementEvents,
    };
  }

  async openAdminLogo(profileId: string, fileId: string) {
    const profile = await this.prisma.agentProfile.findUnique({
      where: { id: profileId },
      select: { logoFileId: true },
    });

    if (!profile) {
      throw new NotFoundException('Agent profile not found');
    }

    if (profile.logoFileId !== fileId) {
      throw new NotFoundException('File not found');
    }

    const file = await this.prisma.storedFile.findFirst({
      where: {
        id: fileId,
        deletedAt: null,
        category: FileCategory.AGENT_LOGO,
      },
      select: { storageKey: true, mimeType: true, originalName: true },
    });

    if (!file || !logoMimeTypes.has(file.mimeType)) {
      throw new NotFoundException('File not found');
    }

    return {
      stream: await this.storage.open(file.storageKey),
      mimeType: file.mimeType,
      originalName: file.originalName,
    };
  }

  async setActive(
    id: string,
    isActive: boolean,
    reason: string,
    actorUserId: string,
  ) {
    const trimmedReason = reason.trim();

    return this.prisma.$transaction(async (tx) => {
      const current = await lockAgentProfile(tx, id);

      if (!current) {
        throw new NotFoundException('Agent profile not found');
      }

      const actors = await tx.$queryRaw<
        Array<{ id: string; role: string; isActive: boolean }>
      >`
        SELECT id, role::text AS role, "isActive"
        FROM users
        WHERE id = ${actorUserId}::uuid
        FOR SHARE
      `;
      const actor = actors[0];

      if (!actor || !actor.isActive || actor.role !== Role.ADMIN) {
        throw new ForbiddenException('Forbidden');
      }

      if (current.isActive === isActive) {
        return { id: current.id, isActive: current.isActive };
      }

      const updated = await tx.agentProfile.update({
        where: { id },
        data: { isActive },
        select: { id: true, isActive: true },
      });
      await this.audit.record(tx, {
        actorUserId,
        action: isActive
          ? AuditAction.AGENT_PROFILE_ACTIVATED
          : AuditAction.AGENT_PROFILE_DEACTIVATED,
        entityType: 'AGENT_PROFILE',
        entityId: id,
        metadata: {
          previousIsActive: current.isActive,
          nextIsActive: isActive,
          reason: trimmedReason,
        },
      });

      return updated;
    });
  }

  private async portfoliosFor(ids: string[]) {
    if (ids.length === 0) {
      return new Map<string, ReturnType<typeof emptyListingCounts>>();
    }

    const [statusRows, publicRows] = await Promise.all([
      this.prisma.property.groupBy({
        by: ['agentProfileId', 'status'],
        where: { ...professionalPropertyWhere, agentProfileId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.property.groupBy({
        by: ['agentProfileId'],
        where: {
          ...publicPropertyWhere,
          ...professionalPropertyWhere,
          agentProfileId: { in: ids },
        },
        _count: { _all: true },
      }),
    ]);

    return portfoliosByProfile(
      statusRows.map((row) => ({
        agentProfileId: row.agentProfileId,
        status: row.status,
        count: row._count._all,
      })),
      publicRows.map((row) => ({
        agentProfileId: row.agentProfileId,
        count: row._count._all,
      })),
    );
  }

  private async portfolioFor(profileId: string) {
    const where = {
      ...professionalPropertyWhere,
      agentProfileId: profileId,
    };
    const [statusRows, publiclyVisible, listingTypes, propertyTypes] =
      await Promise.all([
        this.prisma.property.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.property.count({
          where: {
            ...publicPropertyWhere,
            ...professionalPropertyWhere,
            agentProfileId: profileId,
          },
        }),
        this.prisma.property.groupBy({
          by: ['listingType'],
          where,
          _count: { _all: true },
        }),
        this.prisma.property.groupBy({
          by: ['propertyType'],
          where,
          _count: { _all: true },
        }),
      ]);
    const counts = listingCountsFromGroups(
      statusRows.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      publiclyVisible,
    );
    const summary = {
      ...emptyListingDistribution(),
      ...counts,
      listingTypes: emptyListingDistribution().listingTypes,
      propertyTypes: emptyListingDistribution().propertyTypes,
    };

    return applyListingBreakdown(
      summary,
      listingTypes.map((row) => ({
        listingType: row.listingType,
        count: row._count._all,
      })),
      propertyTypes.map((row) => ({
        propertyType: row.propertyType,
        count: row._count._all,
      })),
    );
  }

  private async professionalPortfolio() {
    const [statusRows, publiclyVisible] = await Promise.all([
      this.prisma.property.groupBy({
        by: ['status'],
        where: professionalPropertyWhere,
        _count: { _all: true },
      }),
      this.prisma.property.count({
        where: { ...publicPropertyWhere, ...professionalPropertyWhere },
      }),
    ]);

    return listingCountsFromGroups(
      statusRows.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      publiclyVisible,
    );
  }

  private async profileMatrix() {
    const rows = await this.prisma.$queryRaw<
      Array<{ profileActive: unknown; userActive: unknown; count: unknown }>
    >`
      SELECT p."isActive"::text AS "profileActive",
             u."isActive"::text AS "userActive",
             COUNT(*)::int AS count
      FROM agent_profiles p
      JOIN users u ON u.id = p."userId"
      GROUP BY 1, 2
    `;

    return rows.map((row) => ({
      profileActive: flag(row.profileActive),
      userActive: flag(row.userActive),
      count: Number(row.count),
    }));
  }

  private async cityDistribution() {
    const rows = await this.prisma.agentProfile.groupBy({
      by: ['city'],
      _count: { _all: true },
    });

    return presentCityDistribution(
      rows.map((row) => ({ city: row.city, count: row._count._all })),
    );
  }

  private async createdSeries(query: AgentSummaryQueryDto) {
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
      FROM agent_profiles
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
}

function adminLogo(profileId: string, fileId: string | null) {
  const url = adminAgentLogoUrl(profileId, fileId);

  return url && fileId ? { fileId, url } : null;
}

function flag(value: unknown) {
  if (value === true || value === 't' || value === 'true' || value === 1) {
    return true;
  }

  if (value === false || value === 'f' || value === 'false' || value === 0) {
    return false;
  }

  return false;
}

function withLogo<T extends { logoFileId: string | null }>(
  row: T,
  toUrl: (fileId: string | null) => string | null = publicFileUrl,
) {
  const { logoFileId, ...rest } = row;

  return { ...rest, logoUrl: toUrl(logoFileId) };
}
