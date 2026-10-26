import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { AuditAction, FileCategory, Role } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicFileUrl } from '../storage/public-file-url';
import { StorageService } from '../storage/storage.service';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const imageLimit = 20;

@Injectable()
export class PropertyImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async upload(
    userId: string,
    propertyId: string,
    file: { buffer: Buffer; originalname?: string } | undefined,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }

    await this.assertOwner(userId, propertyId);
    const saved = await this.storage.save({
      category: FileCategory.PROPERTY_IMAGE,
      ownerId: propertyId,
      originalName: file.originalname ?? 'image',
      bytes: file.buffer,
    });

    try {
      const image = await this.prisma.$transaction((tx) =>
        this.insertImage(tx, userId, propertyId, saved.id),
      );

      return presentImage(image);
    } catch (error) {
      await this.storage.discard(saved.storageKey);
      await this.prisma.storedFile
        .update({ where: { id: saved.id }, data: { deletedAt: new Date() } })
        .catch(() => undefined);
      throw error;
    }
  }

  async makeCover(userId: string, propertyId: string, imageId: string) {
    await this.prisma.$transaction(async (tx) => {
      const profileId = await this.lockProfile(tx, userId);
      this.assertProperty(await this.lockProperty(tx, propertyId), profileId);
      await this.setCover(tx, propertyId, imageId);
    });

    return { id: imageId, isCover: true };
  }

  async reorder(userId: string, propertyId: string, imageIds: string[]) {
    await this.prisma.$transaction(async (tx) => {
      const profileId = await this.lockProfile(tx, userId);
      this.assertProperty(await this.lockProperty(tx, propertyId), profileId);
      await this.writeOrder(tx, propertyId, imageIds);
    });

    return { imageIds };
  }

  async removeMine(userId: string, propertyId: string, imageId: string) {
    const storageKey = await this.prisma.$transaction(async (tx) => {
      const profileId = await this.lockProfile(tx, userId);
      this.assertProperty(await this.lockProperty(tx, propertyId), profileId);

      return this.deleteImage(tx, propertyId, imageId);
    });
    await this.storage.discard(storageKey);

    return { id: imageId };
  }

  async removeForAdmin(adminId: string, propertyId: string, imageId: string) {
    const storageKey = await this.prisma.$transaction(async (tx) => {
      const property = await this.lockProperty(tx, propertyId);

      if (!property) {
        throw new NotFoundException('Property not found');
      }

      const key = await this.deleteImage(tx, propertyId, imageId);
      await this.audit.record(tx, {
        actorUserId: adminId,
        action: AuditAction.PROPERTY_IMAGE_DELETED_BY_ADMIN,
        entityType: 'PROPERTY_IMAGE',
        entityId: imageId,
        metadata: { propertyId },
      });

      return key;
    });
    await this.storage.discard(storageKey);

    return { id: imageId };
  }

  private async insertImage(
    tx: Tx,
    userId: string,
    propertyId: string,
    fileId: string,
  ) {
    const profileId = await this.lockProfile(tx, userId);
    this.assertProperty(await this.lockProperty(tx, propertyId), profileId);
    const count = await tx.propertyImage.count({
      where: { propertyId, deletedAt: null },
    });

    if (count >= imageLimit) {
      throw new ConflictException('Property image limit reached');
    }

    return tx.propertyImage.create({
      data: {
        propertyId,
        fileId,
        sortOrder: count,
        isCover: count === 0,
      },
      select: {
        id: true,
        sortOrder: true,
        isCover: true,
        fileId: true,
        createdAt: true,
      },
    });
  }

  private async setCover(tx: Tx, propertyId: string, imageId: string) {
    const image = await tx.propertyImage.findFirst({
      where: { id: imageId, propertyId, deletedAt: null },
      select: { id: true },
    });

    if (!image) {
      throw new NotFoundException('Property image not found');
    }

    await tx.propertyImage.updateMany({
      where: { propertyId, deletedAt: null, isCover: true },
      data: { isCover: false },
    });
    await tx.propertyImage.update({
      where: { id: imageId },
      data: { isCover: true },
    });
  }

  private async writeOrder(tx: Tx, propertyId: string, imageIds: string[]) {
    const images = await tx.propertyImage.findMany({
      where: { propertyId, deletedAt: null },
      select: { id: true },
    });
    const current = new Set(images.map((image) => image.id));

    if (
      imageIds.length !== current.size ||
      imageIds.some((id) => !current.has(id))
    ) {
      throw new BadRequestException(
        'Image order must include every image once',
      );
    }

    for (const [index, id] of imageIds.entries()) {
      await tx.propertyImage.update({
        where: { id },
        data: { sortOrder: index },
      });
    }
  }

  private async deleteImage(tx: Tx, propertyId: string, imageId: string) {
    const image = await tx.propertyImage.findFirst({
      where: { id: imageId, propertyId, deletedAt: null },
      include: { file: true },
    });

    if (!image) {
      throw new NotFoundException('Property image not found');
    }

    await tx.propertyImage.update({
      where: { id: image.id },
      data: { deletedAt: new Date(), isCover: false },
    });
    await tx.storedFile.update({
      where: { id: image.fileId },
      data: { deletedAt: new Date() },
    });

    if (image.isCover) {
      const next = await tx.propertyImage.findFirst({
        where: { propertyId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: { id: true },
      });

      if (next) {
        await tx.propertyImage.update({
          where: { id: next.id },
          data: { isCover: true },
        });
      }
    }

    return image.file.storageKey;
  }

  private async assertOwner(userId: string, propertyId: string) {
    const profile = await this.prisma.agentProfile.findUnique({
      where: { userId },
      select: { id: true, user: { select: { role: true, isActive: true } } },
    });

    if (!profile || profile.user.role !== Role.AGENT) {
      throw new ForbiddenException('Agent profile not found');
    }

    if (!profile.user.isActive) {
      throw new UnauthorizedException('Unauthorized');
    }

    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, agentProfileId: profile.id, deletedAt: null },
      select: { id: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }
  }

  private async lockProfile(tx: Tx, userId: string) {
    const rows = await tx.$queryRaw<
      Array<{ id: string; userActive: boolean; role: string }>
    >`
      SELECT p.id, u."isActive" AS "userActive", u.role::text AS role
      FROM agent_profiles p
      JOIN users u ON u.id = p."userId"
      WHERE p."userId" = ${userId}::uuid
      FOR UPDATE OF p
    `;
    const row = rows[0];

    if (!row || row.role !== Role.AGENT) {
      throw new ForbiddenException('Agent profile not found');
    }

    if (!row.userActive) {
      throw new UnauthorizedException('Unauthorized');
    }

    return row.id;
  }

  private async lockProperty(tx: Tx, propertyId: string) {
    const rows = await tx.$queryRaw<
      Array<{ id: string; agentProfileId: string; deletedAt: Date | null }>
    >`
      SELECT id, "agentProfileId", "deletedAt"
      FROM properties
      WHERE id = ${propertyId}::uuid
      FOR UPDATE
    `;

    return rows[0] ?? null;
  }

  private assertProperty(
    row: { agentProfileId: string; deletedAt: Date | null } | null,
    profileId: string,
  ) {
    if (!row || row.deletedAt || row.agentProfileId !== profileId) {
      throw new NotFoundException('Property not found');
    }
  }
}

function presentImage(image: {
  id: string;
  sortOrder: number;
  isCover: boolean;
  fileId: string;
  createdAt: Date;
}) {
  return {
    id: image.id,
    url: publicFileUrl(image.fileId),
    sortOrder: image.sortOrder,
    isCover: image.isCover,
    createdAt: image.createdAt,
  };
}
