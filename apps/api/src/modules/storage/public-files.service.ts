import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  FileCategory,
  FileVisibility,
  PropertySellerType,
  PropertyStatus,
} from '../../generated/prisma/enums';
import { StorageService } from './storage.service';

@Injectable()
export class PublicFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async open(id: string) {
    const file = await this.prisma.storedFile.findUnique({ where: { id } });

    if (!file || file.deletedAt || file.visibility !== FileVisibility.PUBLIC) {
      throw new NotFoundException('File not found');
    }

    if (file.category === FileCategory.AGENT_LOGO) {
      const profile = await this.prisma.agentProfile.findFirst({
        where: {
          logoFileId: file.id,
          isActive: true,
          user: { isActive: true },
        },
        select: { id: true },
      });

      if (!profile) {
        throw new NotFoundException('File not found');
      }
    } else if (file.category === FileCategory.PROPERTY_IMAGE) {
      const image = await this.prisma.propertyImage.findFirst({
        where: {
          fileId: file.id,
          deletedAt: null,
          property: {
            status: PropertyStatus.ACTIVE,
            deletedAt: null,
            OR: [
              {
                sellerType: PropertySellerType.INDIVIDUAL,
                ownerUser: { isActive: true },
              },
              {
                sellerType: PropertySellerType.AGENT,
                agentProfile: { isActive: true, user: { isActive: true } },
              },
            ],
          },
        },
        select: { id: true },
      });

      if (!image) {
        throw new NotFoundException('File not found');
      }
    } else {
      throw new NotFoundException('File not found');
    }

    return {
      stream: await this.storage.open(file.storageKey),
      mimeType: file.mimeType,
      originalName: file.originalName,
    };
  }
}
