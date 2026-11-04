import { Logger } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { LocalAdminService } from './local-admin.service';

function createService(env: Record<string, string>) {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const passwords = {
    hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  };
  const service = new LocalAdminService(
    { get: (key: string) => env[key] } as never,
    prisma as never,
    passwords as never,
  );

  return { service, prisma, passwords };
}

describe('LocalAdminService', () => {
  let errorLog: jest.SpiedFunction<typeof Logger.prototype.error>;

  beforeEach(() => {
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not create an admin in production', async () => {
    const { service, prisma } = createService({
      NODE_ENV: 'production',
      ADMIN_EMAIL: 'admin@mail.com',
      ADMIN_PASSWORD: 'admin123',
    });

    await service.onModuleInit();

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates a hashed ADMIN account when the email is unused', async () => {
    const { service, prisma, passwords } = createService({
      NODE_ENV: 'development',
      ADMIN_EMAIL: ' Admin@Mail.com ',
      ADMIN_PASSWORD: 'admin123',
    });
    prisma.user.findUnique.mockResolvedValue(null);

    await service.onModuleInit();

    expect(passwords.hash).toHaveBeenCalledWith('admin123');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'admin@mail.com',
        passwordHash: '$argon2id$hashed',
        role: Role.ADMIN,
        isActive: true,
      },
    });
    expect(JSON.stringify(prisma.user.create.mock.calls)).not.toContain(
      'admin123',
    );
  });

  it('leaves an existing ADMIN account unchanged', async () => {
    const { service, prisma, passwords } = createService({
      NODE_ENV: 'development',
      ADMIN_EMAIL: 'admin@mail.com',
      ADMIN_PASSWORD: 'admin123',
    });
    prisma.user.findUnique.mockResolvedValue({ role: Role.ADMIN });

    await service.onModuleInit();

    expect(passwords.hash).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('does not change a USER or AGENT that already uses the email', async () => {
    const { service, prisma } = createService({
      NODE_ENV: 'development',
      ADMIN_EMAIL: 'admin@mail.com',
      ADMIN_PASSWORD: 'admin123',
    });
    prisma.user.findUnique.mockResolvedValue({ role: Role.USER });

    await service.onModuleInit();

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('role USER'));
    expect(errorLog).not.toHaveBeenCalledWith(
      expect.stringContaining('admin123'),
    );
  });
});
