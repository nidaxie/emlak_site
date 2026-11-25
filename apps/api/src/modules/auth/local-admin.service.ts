import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Role } from '../../generated/prisma/enums';
import { normalizeEmail } from './normalize';
import { PasswordService } from './password.service';

@Injectable()
export class LocalAdminService implements OnModuleInit {
  private readonly logger = new Logger(LocalAdminService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async onModuleInit() {
    if (this.config.get<string>('NODE_ENV') !== 'development') {
      return;
    }

    const email = this.config.get<string>('ADMIN_EMAIL')?.trim() ?? '';
    const password = this.config.get<string>('ADMIN_PASSWORD') ?? '';

    if (!email && !password) {
      return;
    }

    if (!email || !password) {
      this.logger.error(
        'Local admin bootstrap skipped: set both ADMIN_EMAIL and ADMIN_PASSWORD',
      );
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { role: true },
    });

    if (!existing) {
      await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: await this.passwords.hash(password),
          role: Role.ADMIN,
          isActive: true,
        },
      });
      this.logger.log(`Local admin account is ready for ${normalizedEmail}`);
      return;
    }

    if (existing.role === Role.ADMIN) {
      return;
    }

    this.logger.error(
      `Local admin bootstrap skipped: ${normalizedEmail} already exists with role ${existing.role}. The role was not changed.`,
    );
  }
}
