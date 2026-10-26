import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, FileCategory } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { blankToNull } from '../auth/normalize';
import { publicFileUrl } from '../storage/public-file-url';
import { StorageService } from '../storage/storage.service';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { UpdateAgentProfileDto } from './dto/update-agent-profile.dto';

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
      where: { slug, isActive: true },
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

    return withLogo(profile);
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

    await this.getMine(userId);

    const updated = await this.prisma.agentProfile.update({
      where: { userId },
      data,
      select: selfAgentSelect,
    });

    return withLogo(updated);
  }

  async uploadLogo(
    userId: string,
    file: { buffer: Buffer; originalname?: string },
  ) {
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
    const where = {
      ...(query.isActive === undefined
        ? {}
        : { isActive: query.isActive === 'true' }),
      ...(query.companyName
        ? {
            companyName: {
              contains: query.companyName,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(query.city
        ? { city: { contains: query.city, mode: 'insensitive' as const } }
        : {}),
      ...(query.district
        ? {
            district: {
              contains: query.district,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.agentProfile.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          companyName: true,
          city: true,
          district: true,
          isActive: true,
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
      this.prisma.agentProfile.count({ where }),
    ]);

    return { items, page, limit, total };
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

    return withLogo(profile);
  }

  async setActive(id: string, isActive: boolean, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.agentProfile.findUnique({
        where: { id },
        select: { id: true, isActive: true },
      });

      if (!current) {
        throw new NotFoundException('Agent profile not found');
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
      });

      return updated;
    });
  }
}

function withLogo<T extends { logoFileId: string | null }>(row: T) {
  const { logoFileId, ...rest } = row;

  return { ...rest, logoUrl: publicFileUrl(logoFileId) };
}
