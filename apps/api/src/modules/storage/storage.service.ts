import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FileCategory } from '../../generated/prisma/enums';
import { inspectUpload, sanitizeFileName, storageFolder } from './file-policy';
import { LocalObjectStorage } from './local-object-storage';

@Injectable()
export class StorageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: LocalObjectStorage,
  ) {}

  async save(input: {
    category: FileCategory;
    ownerId: string;
    originalName: string;
    bytes: Buffer;
  }) {
    const inspected = inspectUpload(input.category, input.bytes);
    const id = randomUUID();
    const storageKey = `${storageFolder(input.category, input.ownerId)}/${id}.${inspected.extension}`;
    await this.objects.put(storageKey, input.bytes);

    try {
      return await this.prisma.storedFile.create({
        data: {
          id,
          storageKey,
          originalName: sanitizeFileName(input.originalName),
          mimeType: inspected.mimeType,
          sizeBytes: inspected.sizeBytes,
          visibility: inspected.visibility,
          category: input.category,
        },
      });
    } catch (error) {
      await this.discard(storageKey);
      throw error;
    }
  }

  async remove(storageKey: string) {
    await this.objects.delete(storageKey);
  }

  async open(storageKey: string) {
    return this.objects.open(storageKey);
  }

  async discard(storageKey: string) {
    try {
      await this.objects.delete(storageKey);
    } catch {
      return;
    }
  }
}
