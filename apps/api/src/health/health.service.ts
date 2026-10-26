import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';

export type HealthReport = {
  status: 'ok';
  checks: {
    database: 'up';
    postgis: 'up';
  };
};

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException('Database unavailable');
    }

    const extensions = await this.prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'postgis'
    `;

    if (extensions.length === 0) {
      throw new ServiceUnavailableException(
        'PostGIS extension is not available',
      );
    }

    return {
      status: 'ok',
      checks: {
        database: 'up',
        postgis: 'up',
      },
    };
  }
}
