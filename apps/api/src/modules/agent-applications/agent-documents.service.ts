import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import {
  AgentDocumentType,
  ApplicationStatus,
  AuditAction,
  FileCategory,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { contentDisposition } from '../storage/file-policy';
import { StorageService } from '../storage/storage.service';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const documentSelect = {
  id: true,
  documentType: true,
  createdAt: true,
  file: {
    select: {
      originalName: true,
      mimeType: true,
      sizeBytes: true,
    },
  },
} as const;

@Injectable()
export class AgentDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async upload(
    userId: string,
    documentType: AgentDocumentType,
    file: { buffer: Buffer; originalname?: string } | undefined,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }

    const pending = await this.prisma.agentApplication.findFirst({
      where: { userId, status: ApplicationStatus.PENDING },
      select: { id: true },
    });

    if (!pending) {
      const existing = await this.prisma.agentApplication.findFirst({
        where: { userId },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException('Agent application not found');
      }

      throw new ConflictException('Application is no longer pending');
    }

    const saved = await this.storage.save({
      category: categoryFor(documentType),
      ownerId: pending.id,
      originalName: file.originalname ?? 'document',
      bytes: file.buffer,
    });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const applicationId = await this.lockPending(tx, userId);

        if (!applicationId) {
          throw new ConflictException('Application is no longer pending');
        }

        const current = await tx.agentApplicationDocument.findUnique({
          where: {
            applicationId_documentType: { applicationId, documentType },
          },
          include: { file: true },
        });

        if (current) {
          await tx.agentApplicationDocument.update({
            where: { id: current.id },
            data: { fileId: saved.id },
          });
          await tx.storedFile.update({
            where: { id: current.fileId },
            data: { deletedAt: new Date() },
          });
          await this.audit.record(tx, {
            actorUserId: userId,
            action: AuditAction.AGENT_DOCUMENT_REPLACED,
            entityType: 'AGENT_APPLICATION_DOCUMENT',
            entityId: current.id,
            metadata: { documentType },
          });

          return {
            id: current.id,
            replacedKey: current.file.storageKey,
          };
        }

        const created = await tx.agentApplicationDocument.create({
          data: {
            applicationId,
            fileId: saved.id,
            documentType,
          },
          select: { id: true, createdAt: true },
        });
        await this.audit.record(tx, {
          actorUserId: userId,
          action: AuditAction.AGENT_DOCUMENT_UPLOADED,
          entityType: 'AGENT_APPLICATION_DOCUMENT',
          entityId: created.id,
          metadata: { documentType },
        });

        return {
          id: created.id,
          replacedKey: null,
          createdAt: created.createdAt,
        };
      });

      if (result.replacedKey) {
        await this.storage.discard(result.replacedKey);
      }

      return {
        id: result.id,
        documentType,
        originalName: saved.originalName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
      };
    } catch (error) {
      await this.storage.discard(saved.storageKey);
      await this.prisma.storedFile
        .update({ where: { id: saved.id }, data: { deletedAt: new Date() } })
        .catch(() => undefined);

      if (isUniqueViolation(error)) {
        throw new ConflictException('Document already exists');
      }

      throw error;
    }
  }

  async listMine(userId: string) {
    const application = await this.prisma.agentApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!application) {
      throw new NotFoundException('Agent application not found');
    }

    return this.listForApplication(application.id);
  }

  async openMine(userId: string, documentId: string) {
    const document = await this.prisma.agentApplicationDocument.findFirst({
      where: { id: documentId, application: { userId } },
      include: { file: true },
    });

    if (!document || document.file.deletedAt) {
      throw new NotFoundException('Document not found');
    }

    return this.openFile(document.file);
  }

  async listForAdmin(applicationId: string) {
    const application = await this.prisma.agentApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });

    if (!application) {
      throw new NotFoundException('Agent application not found');
    }

    return this.listForApplication(applicationId);
  }

  async openForAdmin(applicationId: string, documentId: string) {
    const document = await this.prisma.agentApplicationDocument.findFirst({
      where: { id: documentId, applicationId },
      include: { file: true },
    });

    if (!document || document.file.deletedAt) {
      throw new NotFoundException('Document not found');
    }

    return this.openFile(document.file);
  }

  private async listForApplication(applicationId: string) {
    const documents = await this.prisma.agentApplicationDocument.findMany({
      where: { applicationId, file: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: documentSelect,
    });

    return documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      originalName: document.file.originalName,
      mimeType: document.file.mimeType,
      sizeBytes: document.file.sizeBytes,
      createdAt: document.createdAt,
    }));
  }

  private async openFile(file: {
    storageKey: string;
    mimeType: string;
    originalName: string;
  }) {
    return {
      stream: await this.storage.open(file.storageKey),
      mimeType: file.mimeType,
      disposition: contentDisposition('attachment', file.originalName),
    };
  }

  private async lockPending(tx: Tx, userId: string) {
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

function categoryFor(documentType: AgentDocumentType) {
  return documentType === AgentDocumentType.TAX_CERTIFICATE
    ? FileCategory.AGENT_TAX_DOCUMENT
    : FileCategory.AGENT_AUTHORIZATION_DOCUMENT;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
