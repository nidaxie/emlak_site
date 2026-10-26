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
  AgentDocumentType,
  ApplicationStatus,
  AuditAction,
  Role,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { allocateAgentSlug } from '../agents/agent-slug';
import { AuditService } from '../audit/audit.service';
import { blankToNull, normalizeEmail } from '../auth/normalize';
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

        const pending = await tx.agentApplication.findFirst({
          where: { userId, status: ApplicationStatus.PENDING },
          select: { id: true },
        });

        if (pending) {
          throw new ConflictException('Pending application already exists');
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
          },
          select: ownApplicationSelect,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Pending application already exists');
      }

      throw error;
    }
  }

  async getMine(userId: string) {
    const application = await this.prisma.agentApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: ownApplicationSelect,
    });

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
      const pendingId = await this.lockPendingApplication(tx, userId);

      if (!pendingId) {
        const existing = await tx.agentApplication.findFirst({
          where: { userId },
          select: { id: true },
        });

        if (!existing) {
          throw new NotFoundException('Agent application not found');
        }

        throw new ConflictException('Application is no longer pending');
      }

      return tx.agentApplication.update({
        where: { id: pendingId },
        data,
        select: ownApplicationSelect,
      });
    });
  }

  async listForAdmin(query: ListAgentApplicationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.agentApplication.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          companyName: true,
          city: true,
          district: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.agentApplication.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async getForAdmin(id: string) {
    const application = await this.prisma.agentApplication.findUnique({
      where: { id },
      select: {
        ...ownApplicationSelect,
        userId: true,
        reviewedById: true,
        user: { select: reviewSelect },
      },
    });

    if (!application) {
      throw new NotFoundException('Agent application not found');
    }

    return application;
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

      if (application.status !== ApplicationStatus.PENDING) {
        throw new ConflictException('Application is no longer pending');
      }

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

      const documents = await tx.agentApplicationDocument.findMany({
        where: { applicationId: application.id, file: { deletedAt: null } },
        select: { documentType: true },
      });
      const documentTypes = new Set(documents.map((item) => item.documentType));

      if (
        !documentTypes.has(AgentDocumentType.TAX_CERTIFICATE) ||
        !documentTypes.has(AgentDocumentType.AUTHORIZATION_CERTIFICATE)
      ) {
        throw new ConflictException('Required documents are missing');
      }

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

      const updatedApplication = await tx.agentApplication.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
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

      if (locked.status !== ApplicationStatus.PENDING) {
        throw new ConflictException('Application is no longer pending');
      }

      const reviewer = await tx.user.findUnique({
        where: { id: adminId },
        select: { id: true, role: true, isActive: true },
      });

      if (!reviewer || !reviewer.isActive || reviewer.role !== Role.ADMIN) {
        throw new ForbiddenException('Forbidden');
      }

      const application = await tx.agentApplication.update({
        where: { id: locked.id },
        data: {
          status: ApplicationStatus.REJECTED,
          rejectionReason: reason,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
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

  private async lockPendingApplication(tx: Tx, userId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM agent_applications
      WHERE "userId" = ${userId}::uuid
        AND status = 'PENDING'
      FOR UPDATE
    `;

    return rows[0]?.id ?? null;
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
