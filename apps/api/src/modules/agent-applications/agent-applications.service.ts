import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import {
  ApplicationStatus,
  AuditAction,
  Role,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { allocateAgentSlug } from '../agents/agent-slug';
import { AuditService } from '../audit/audit.service';
import { blankToNull, normalizeEmail } from '../auth/normalize';
import {
  parseCreatedBound,
  registrationPoints,
} from '../users/admin-user-query';
import {
  applicationListWhere,
  documentCompletion,
} from './agent-application-query';
import {
  assertApplicationTransition,
  hasRequiredAgentDocuments,
  selectCurrentApplication,
} from './application-lifecycle';
import { AgentApplicationSummaryQueryDto } from './dto/agent-application-summary-query.dto';
import { CreateAgentApplicationDto } from './dto/create-agent-application.dto';
import { ListAgentApplicationsQueryDto } from './dto/list-agent-applications-query.dto';
import { UpdateAgentApplicationDto } from './dto/update-agent-application.dto';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const ownApplicationSelect = {
  id: true,
  status: true,
  companyName: true,
  authorizedFirstName: true,
  authorizedLastName: true,
  phone: true,
  email: true,
  taxNumber: true,
  city: true,
  district: true,
  address: true,
  description: true,
  rejectionReason: true,
  reviewedAt: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const reviewSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

const reviewerSelect = {
  id: true,
  firstName: true,
  lastName: true,
} as const;

const liveDocumentSelect = {
  where: { file: { deletedAt: null } },
  select: { documentType: true },
} as const;

const profileLinkSelect = {
  id: true,
  slug: true,
  companyName: true,
  isActive: true,
} as const;

@Injectable()
export class AgentApplicationsService {
  private readonly logger = new Logger(AgentApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateAgentApplicationDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await this.lockUser(tx, userId);

        if (!user.isActive) {
          throw new UnauthorizedException('Unauthorized');
        }

        if (user.role !== Role.USER) {
          throw new ForbiddenException('Forbidden');
        }

        const profile = await tx.agentProfile.findUnique({
          where: { userId },
          select: { id: true },
        });

        if (profile) {
          throw new ConflictException('Agent profile already exists');
        }

        const existing = await tx.agentApplication.findMany({
          where: { userId },
          select: { status: true },
        });
        const statuses = new Set(existing.map((row) => row.status));

        if (statuses.has(ApplicationStatus.PENDING)) {
          throw new ConflictException('Pending application already exists');
        }

        if (statuses.has(ApplicationStatus.DRAFT)) {
          throw new ConflictException('Draft application already exists');
        }

        if (statuses.has(ApplicationStatus.APPROVED)) {
          throw new ConflictException('Application is already approved');
        }

        if (statuses.has(ApplicationStatus.REJECTED)) {
          throw new ConflictException('Rejected application can be revised');
        }

        return tx.agentApplication.create({
          data: {
            userId,
            companyName: dto.companyName,
            authorizedFirstName: dto.authorizedFirstName,
            authorizedLastName: dto.authorizedLastName,
            phone: dto.phone,
            email: normalizeEmail(dto.email),
            taxNumber: dto.taxNumber,
            city: dto.city,
            district: dto.district,
            address: dto.address,
            description: blankToNull(dto.description) ?? null,
            status: ApplicationStatus.DRAFT,
            submittedAt: null,
          },
          select: ownApplicationSelect,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Draft application already exists');
      }

      throw error;
    }
  }

  async getMine(userId: string) {
    const applications = await this.prisma.agentApplication.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: ownApplicationSelect,
    });
    const application = selectCurrentApplication(applications);

    if (!application) {
      throw new NotFoundException('Agent application not found');
    }

    return application;
  }

  async updateMine(userId: string, dto: UpdateAgentApplicationDto) {
    const data = applicationPatch(dto);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    return this.prisma.$transaction(async (tx) => {
      const draftId = await this.lockDraftApplication(tx, userId);

      if (!draftId) {
        const existing = await tx.agentApplication.findFirst({
          where: { userId },
          select: { id: true },
        });

        if (!existing) {
          throw new NotFoundException('Agent application not found');
        }

        throw new ConflictException('Application is not a draft');
      }

      return tx.agentApplication.update({
        where: { id: draftId },
        data,
        select: ownApplicationSelect,
      });
    });
  }

  async submit(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await this.lockUser(tx, userId);

      if (!user.isActive) {
        throw new UnauthorizedException('Unauthorized');
      }

      if (user.role !== Role.USER) {
        throw new ForbiddenException('Forbidden');
      }

      const draftId = await this.lockDraftApplication(tx, userId);

      if (!draftId) {
        const existing = await tx.agentApplication.findFirst({
          where: { userId },
          select: { status: true },
        });

        if (!existing) {
          throw new NotFoundException('Agent application not found');
        }

        assertApplicationTransition(
          existing.status,
          ApplicationStatus.PENDING,
          'Application is not a draft',
        );
        throw new ConflictException('Application is not a draft');
      }

      const snapshot = await tx.agentApplication.findUniqueOrThrow({
        where: { id: draftId },
      });
      assertSubmittable(snapshot);
      await this.assertRequiredDocuments(tx, draftId);

      return tx.agentApplication.update({
        where: { id: draftId },
        data: {
          status: ApplicationStatus.PENDING,
          submittedAt: new Date(),
          rejectionReason: null,
          reviewedById: null,
          reviewedAt: null,
        },
        select: ownApplicationSelect,
      });
    });
  }

  async revise(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await this.lockUser(tx, userId);

      if (!user.isActive) {
        throw new UnauthorizedException('Unauthorized');
      }

      if (user.role !== Role.USER) {
        throw new ForbiddenException('Forbidden');
      }

      const locked = await this.lockApplications(tx, userId);
      const current = selectCurrentApplication(locked);

      if (!current) {
        throw new NotFoundException('Agent application not found');
      }

      assertApplicationTransition(
        current.status,
        ApplicationStatus.DRAFT,
        'Application is not rejected',
      );

      return tx.agentApplication.update({
        where: { id: current.id },
        data: {
          status: ApplicationStatus.DRAFT,
          submittedAt: null,
          rejectionReason: null,
          reviewedById: null,
          reviewedAt: null,
        },
        select: ownApplicationSelect,
      });
    });
  }

  async listForAdmin(query: ListAgentApplicationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = applicationListWhere(query);
    const orderBy =
      query.status === ApplicationStatus.PENDING
        ? [
            { submittedAt: { sort: 'desc' as const, nulls: 'last' as const } },
            { id: 'desc' as const },
          ]
        : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const [rows, total] = await Promise.all([
      this.prisma.agentApplication.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          companyName: true,
          phone: true,
          email: true,
          city: true,
          district: true,
          createdAt: true,
          submittedAt: true,
          reviewedAt: true,
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
          reviewedBy: { select: reviewerSelect },
          documents: liveDocumentSelect,
        },
      }),
      this.prisma.agentApplication.count({ where }),
    ]);

    return {
      items: rows.map(({ documents, ...item }) => ({
        ...item,
        documentCompletion: documentCompletion(
          documents.map((document) => document.documentType),
        ),
      })),
      page,
      limit,
      total,
    };
  }

  async summary(query: AgentApplicationSummaryQueryDto) {
    const grouped = await this.prisma.agentApplication.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const statuses = {
      DRAFT: 0,
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
    };

    for (const row of grouped) {
      statuses[row.status] = row._count._all;
    }

    const oldest = await this.prisma.agentApplication.findFirst({
      where: {
        status: ApplicationStatus.PENDING,
        submittedAt: { not: null },
      },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
      select: { id: true, submittedAt: true },
    });
    const submittedAt = oldest?.submittedAt ?? null;

    return {
      total:
        statuses.DRAFT +
        statuses.PENDING +
        statuses.APPROVED +
        statuses.REJECTED,
      statuses,
      oldestPending: submittedAt
        ? {
            id: oldest!.id,
            submittedAt: submittedAt.toISOString(),
            waitingMs: Date.now() - submittedAt.getTime(),
          }
        : null,
      created: await this.createdSeries(query),
    };
  }

  async getForAdmin(id: string) {
    const application = await this.prisma.agentApplication.findUnique({
      where: { id },
      select: {
        ...ownApplicationSelect,
        userId: true,
        reviewedById: true,
        user: {
          select: {
            ...reviewSelect,
            agentProfile: { select: profileLinkSelect },
          },
        },
        reviewedBy: { select: reviewerSelect },
        documents: liveDocumentSelect,
      },
    });

    if (!application) {
      throw new NotFoundException('Agent application not found');
    }

    const { documents, user, ...rest } = application;
    const { agentProfile, ...applicant } = user;

    return {
      ...rest,
      user: applicant,
      documentCompletion: documentCompletion(
        documents.map((document) => document.documentType),
      ),
      agentProfile:
        application.status === ApplicationStatus.APPROVED ? agentProfile : null,
    };
  }

  async approve(id: string, adminId: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const result = await this.approveOnce(id, adminId);
        this.logger.log(
          `agent application approved applicationId=${result.application.id} userId=${result.user.id} adminId=${adminId}`,
        );
        return result;
      } catch (error) {
        if (isSlugConflict(error) && attempt < 4) {
          continue;
        }

        if (isUniqueViolation(error)) {
          throw new ConflictException('Agent profile already exists');
        }

        throw error;
      }
    }

    throw new ConflictException('Agent profile already exists');
  }

  private async approveOnce(id: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const application = await this.lockApplication(tx, id);

      if (!application) {
        throw new NotFoundException('Agent application not found');
      }

      assertApplicationTransition(
        application.status as ApplicationStatus,
        ApplicationStatus.APPROVED,
        'Application is no longer pending',
      );

      const user = await this.lockUser(tx, application.userId);

      if (!user.isActive) {
        throw new ConflictException('User account is inactive');
      }

      if (user.role !== Role.USER) {
        throw new ConflictException('User is not eligible for approval');
      }

      const reviewer = await tx.user.findUnique({
        where: { id: adminId },
        select: { id: true, role: true, isActive: true },
      });

      if (!reviewer || !reviewer.isActive || reviewer.role !== Role.ADMIN) {
        throw new ForbiddenException('Forbidden');
      }

      const existingProfile = await tx.agentProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (existingProfile) {
        throw new ConflictException('Agent profile already exists');
      }

      await this.assertRequiredDocuments(tx, application.id);

      const snapshot = await tx.agentApplication.findUniqueOrThrow({
        where: { id: application.id },
      });

      const slug = await allocateAgentSlug(
        snapshot.companyName,
        async (base) => {
          const rows = await tx.agentProfile.findMany({
            where: {
              OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }],
            },
            select: { slug: true },
          });

          return rows.map((row) => row.slug);
        },
      );

      const profile = await tx.agentProfile.create({
        data: {
          userId: user.id,
          slug,
          companyName: snapshot.companyName,
          phone: snapshot.phone,
          email: snapshot.email,
          taxNumber: snapshot.taxNumber,
          city: snapshot.city,
          district: snapshot.district,
          address: snapshot.address,
          description: snapshot.description,
        },
        select: {
          id: true,
          userId: true,
          slug: true,
          companyName: true,
          isActive: true,
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { role: Role.AGENT },
        select: { id: true, role: true },
      });

      const decision = await tx.agentApplication.updateMany({
        where: { id: application.id, status: ApplicationStatus.PENDING },
        data: {
          status: ApplicationStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });

      if (decision.count !== 1) {
        throw new ConflictException('Application is no longer pending');
      }

      const updatedApplication = await tx.agentApplication.findUniqueOrThrow({
        where: { id: application.id },
        select: {
          id: true,
          status: true,
          userId: true,
          reviewedById: true,
          reviewedAt: true,
          companyName: true,
        },
      });

      await this.audit.record(tx, {
        actorUserId: adminId,
        action: AuditAction.AGENT_APPLICATION_APPROVED,
        entityType: 'AGENT_APPLICATION',
        entityId: application.id,
      });

      return {
        application: updatedApplication,
        profile,
        user: updatedUser,
      };
    });
  }

  async reject(id: string, adminId: string, reason: string) {
    const application = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockApplication(tx, id);

      if (!locked) {
        throw new NotFoundException('Agent application not found');
      }

      assertApplicationTransition(
        locked.status as ApplicationStatus,
        ApplicationStatus.REJECTED,
        'Application is no longer pending',
      );

      const reviewer = await tx.user.findUnique({
        where: { id: adminId },
        select: { id: true, role: true, isActive: true },
      });

      if (!reviewer || !reviewer.isActive || reviewer.role !== Role.ADMIN) {
        throw new ForbiddenException('Forbidden');
      }

      const decision = await tx.agentApplication.updateMany({
        where: { id: locked.id, status: ApplicationStatus.PENDING },
        data: {
          status: ApplicationStatus.REJECTED,
          rejectionReason: reason,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });

      if (decision.count !== 1) {
        throw new ConflictException('Application is no longer pending');
      }

      const application = await tx.agentApplication.findUniqueOrThrow({
        where: { id: locked.id },
        select: {
          id: true,
          status: true,
          userId: true,
          companyName: true,
          rejectionReason: true,
          reviewedById: true,
          reviewedAt: true,
        },
      });

      await this.audit.record(tx, {
        actorUserId: adminId,
        action: AuditAction.AGENT_APPLICATION_REJECTED,
        entityType: 'AGENT_APPLICATION',
        entityId: application.id,
        metadata: { reason },
      });

      return application;
    });

    this.logger.log(
      `agent application rejected applicationId=${application.id} userId=${application.userId} adminId=${adminId}`,
    );

    return application;
  }

  private async lockUser(tx: Tx, userId: string) {
    const rows = await tx.$queryRaw<
      Array<{ id: string; role: string; isActive: boolean }>
    >`
      SELECT id, role::text AS role, "isActive"
      FROM users
      WHERE id = ${userId}::uuid
      FOR UPDATE
    `;
    const row = rows[0];

    if (!row) {
      throw new UnauthorizedException('Unauthorized');
    }

    return row;
  }

  private async lockApplication(tx: Tx, id: string) {
    const rows = await tx.$queryRaw<
      Array<{ id: string; status: string; userId: string }>
    >`
      SELECT id, status::text AS status, "userId"
      FROM agent_applications
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;

    return rows[0] ?? null;
  }

  private async lockDraftApplication(tx: Tx, userId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM agent_applications
      WHERE "userId" = ${userId}::uuid
        AND status = 'DRAFT'
      ORDER BY "createdAt" DESC, id DESC
      LIMIT 1
      FOR UPDATE
    `;

    return rows[0]?.id ?? null;
  }

  private async lockApplications(tx: Tx, userId: string) {
    return tx.$queryRaw<
      Array<{ id: string; status: ApplicationStatus; createdAt: Date }>
    >`
      SELECT id, status::text AS status, "createdAt"
      FROM agent_applications
      WHERE "userId" = ${userId}::uuid
      ORDER BY "createdAt" DESC, id DESC
      FOR UPDATE
    `;
  }

  private async createdSeries(query: AgentApplicationSummaryQueryDto) {
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
      FROM agent_applications
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

  private async assertRequiredDocuments(tx: Tx, applicationId: string) {
    const documents = await tx.agentApplicationDocument.findMany({
      where: { applicationId, file: { deletedAt: null } },
      select: { documentType: true },
    });

    if (
      !hasRequiredAgentDocuments(
        new Set(documents.map((item) => item.documentType)),
      )
    ) {
      throw new ConflictException('Required documents are missing');
    }
  }
}

function assertSubmittable(application: {
  companyName: string;
  authorizedFirstName: string;
  authorizedLastName: string;
  phone: string;
  email: string;
  taxNumber: string;
  city: string;
  district: string;
  address: string;
}) {
  const required = [
    application.companyName,
    application.authorizedFirstName,
    application.authorizedLastName,
    application.phone,
    application.email,
    application.taxNumber,
    application.city,
    application.district,
    application.address,
  ];

  if (required.some((value) => value.trim() === '')) {
    throw new BadRequestException('Application is incomplete');
  }
}

function applicationPatch(dto: UpdateAgentApplicationDto) {
  return {
    ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
    ...(dto.authorizedFirstName !== undefined
      ? { authorizedFirstName: dto.authorizedFirstName }
      : {}),
    ...(dto.authorizedLastName !== undefined
      ? { authorizedLastName: dto.authorizedLastName }
      : {}),
    ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
    ...(dto.email !== undefined ? { email: normalizeEmail(dto.email) } : {}),
    ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber } : {}),
    ...(dto.city !== undefined ? { city: dto.city } : {}),
    ...(dto.district !== undefined ? { district: dto.district } : {}),
    ...(dto.address !== undefined ? { address: dto.address } : {}),
    ...(dto.description !== undefined
      ? { description: blankToNull(dto.description) }
      : {}),
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function isSlugConflict(error: unknown) {
  if (!isUniqueViolation(error)) {
    return false;
  }

  const meta = (error as { meta?: { target?: unknown } }).meta?.target;
  const target = Array.isArray(meta)
    ? meta.map(String).join(' ')
    : typeof meta === 'string'
      ? meta
      : '';

  return !target.includes('userId');
}
