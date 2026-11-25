import { FileCategory } from '../../generated/prisma/enums';
import {
  assertStorageKey,
  detectFileType,
  inspectUpload,
  sanitizeFileName,
} from './file-policy';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP'),
]);
const pdf = Buffer.from('%PDF-1.4\n');

describe('file policy', () => {
  it('detects allowed signatures and rejects executables', () => {
    expect(detectFileType(jpeg)?.mimeType).toBe('image/jpeg');
    expect(detectFileType(png)?.extension).toBe('png');
    expect(detectFileType(webp)?.mimeType).toBe('image/webp');
    expect(detectFileType(pdf)?.mimeType).toBe('application/pdf');
    expect(detectFileType(Buffer.from('MZ\x90\x00'))).toBeNull();
    expect(detectFileType(Buffer.from('<svg></svg>'))).toBeNull();
    expect(detectFileType(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))).toBeNull();
  });

  it('rejects the wrong type and an oversized logo', () => {
    expect(() => inspectUpload(FileCategory.AGENT_LOGO, pdf)).toThrow(
      'Unsupported file type',
    );
    expect(() =>
      inspectUpload(
        FileCategory.AGENT_LOGO,
        Buffer.concat([jpeg, Buffer.alloc(5 * 1024 * 1024)]),
      ),
    ).toThrow('File is too large');
    expect(inspectUpload(FileCategory.AGENT_TAX_DOCUMENT, pdf).visibility).toBe(
      'PRIVATE',
    );
  });

  it('blocks path traversal in storage keys and file names', () => {
    expect(() => assertStorageKey('../secret.jpg')).toThrow(
      'Invalid storage key',
    );
    expect(() => assertStorageKey('agents/../../etc/passwd.jpg')).toThrow(
      'Invalid storage key',
    );
    expect(
      assertStorageKey(
        'agents/11111111-1111-1111-1111-111111111111/logo/22222222-2222-2222-2222-222222222222.jpg',
      ),
    ).toContain('/logo/');
    expect(sanitizeFileName('../../tax certificate.pdf')).toBe(
      'tax certificate.pdf',
    );
  });
});
