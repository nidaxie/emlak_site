import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaClient } from '../../generated/prisma/client';
import { AuditAction } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const blockedMetadata = [
  'password',
  'passwordhash',
  'refreshtoken',
  'token',
  'secret',
  'storagekey',
  'path',
];

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    tx: Tx,
    input: {
      actorUserId: string;
      action: AuditAction;
      entityType: string;
      entityId: string;
      metadata?: Prisma.InputJsonObject;
    },
  ) {
    return tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: safeMetadata(input.metadata),
      },
    });
  }

  async list(query: {
    entityType?: string;
    entityId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          actorUserId: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, page, limit, total };
  }
}

function safeMetadata(metadata: Prisma.InputJsonObject | undefined) {
  if (!metadata) {
    return undefined;
  }

  const copy: Record<string, Prisma.InputJsonValue> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (
      blockedMetadata.some((blocked) => key.toLowerCase().includes(blocked))
    ) {
      continue;
    }

    copy[key] = value as Prisma.InputJsonValue;
  }

  return copy;
}
