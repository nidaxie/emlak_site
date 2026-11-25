import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import { FileCategory, FileVisibility } from '../../generated/prisma/enums';

const megabyte = 1024 * 1024;

export const fileRules: Record<
  FileCategory,
  { visibility: FileVisibility; maxBytes: number; mimeTypes: string[] }
> = {
  AGENT_LOGO: {
    visibility: FileVisibility.PUBLIC,
    maxBytes: 5 * megabyte,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  AGENT_TAX_DOCUMENT: {
    visibility: FileVisibility.PRIVATE,
    maxBytes: 10 * megabyte,
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  AGENT_AUTHORIZATION_DOCUMENT: {
    visibility: FileVisibility.PRIVATE,
    maxBytes: 10 * megabyte,
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  PROPERTY_IMAGE: {
    visibility: FileVisibility.PUBLIC,
    maxBytes: 10 * megabyte,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
};

const safeKey =
  /^(?:agents|properties)\/[0-9a-f-]+\/(?:logo|documents|images)\/[0-9a-f-]+\.(?:jpg|png|webp|pdf)$/;

export type DetectedFile = {
  mimeType: string;
  extension: 'jpg' | 'png' | 'webp' | 'pdf';
};

export function detectFileType(bytes: Buffer): DetectedFile | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }

  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }

  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }

  return null;
}

export function inspectUpload(category: FileCategory, bytes: Buffer) {
  const rule = fileRules[category];

  if (bytes.length === 0) {
    throw new BadRequestException('File is required');
  }

  if (bytes.length > rule.maxBytes) {
    throw new PayloadTooLargeException('File is too large');
  }

  const detected = detectFileType(bytes);

  if (!detected || !rule.mimeTypes.includes(detected.mimeType)) {
    throw new UnsupportedMediaTypeException('Unsupported file type');
  }

  return { ...detected, visibility: rule.visibility, sizeBytes: bytes.length };
}

export function assertStorageKey(storageKey: string) {
  if (!safeKey.test(storageKey) || storageKey.includes('..')) {
    throw new BadRequestException('Invalid storage key');
  }

  return storageKey;
}

export function sanitizeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? 'file';
  const cleaned = base.replace(/[^\w.\- ()]/g, '').slice(0, 120);

  return cleaned.length > 0 ? cleaned : 'file';
}

export function contentDisposition(
  kind: 'inline' | 'attachment',
  originalName: string,
) {
  const safe = sanitizeFileName(originalName).replace(/"/g, '');
  const encoded = encodeURIComponent(sanitizeFileName(originalName));

  return `${kind}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export function storageFolder(category: FileCategory, ownerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) {
    throw new BadRequestException('Invalid storage key');
  }

  if (category === FileCategory.AGENT_LOGO) {
    return `agents/${ownerId}/logo`;
  }

  if (category === FileCategory.PROPERTY_IMAGE) {
    return `properties/${ownerId}/images`;
  }

  return `agents/${ownerId}/documents`;
}
