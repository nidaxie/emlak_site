import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertStorageKey } from './file-policy';

export interface ObjectStorage {
  put(storageKey: string, body: Buffer): Promise<void>;
  delete(storageKey: string): Promise<void>;
  open(storageKey: string): Promise<NodeJS.ReadableStream>;
}

@Injectable()
export class LocalObjectStorage implements ObjectStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    const configured = config.get<string>('STORAGE_LOCAL_ROOT');
    this.root = path.resolve(
      configured && configured.length > 0 ? configured : 'storage',
    );
  }

  async put(storageKey: string, body: Buffer) {
    const target = this.resolve(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body, { flag: 'wx' });
  }

  async delete(storageKey: string) {
    const target = this.resolve(storageKey);

    try {
      await unlink(target);
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
    }
  }

  async open(storageKey: string) {
    const target = this.resolve(storageKey);

    try {
      await stat(target);
    } catch (error) {
      if (isMissing(error)) {
        throw new NotFoundException('File not found');
      }

      throw error;
    }

    return createReadStream(target);
  }

  private resolve(storageKey: string) {
    const key = assertStorageKey(storageKey);
    const target = path.resolve(this.root, key);
    const rootWithSep = this.root.endsWith(path.sep)
      ? this.root
      : `${this.root}${path.sep}`;

    if (target !== this.root && !target.startsWith(rootWithSep)) {
      throw new NotFoundException('File not found');
    }

    return target;
  }
}

function isMissing(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
