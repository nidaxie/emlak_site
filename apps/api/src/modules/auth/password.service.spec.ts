import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('stores an argon2id hash and verifies only the same password', async () => {
    const passwordHash = await service.hash('password123');

    expect(passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(passwordHash).not.toContain('password123');
    await expect(service.verify(passwordHash, 'password123')).resolves.toBe(
      true,
    );
    await expect(service.verify(passwordHash, 'other-password')).resolves.toBe(
      false,
    );
  });

  it('rejects a malformed hash', async () => {
    await expect(service.verify('not-a-hash', 'password123')).resolves.toBe(
      false,
    );
  });
});
