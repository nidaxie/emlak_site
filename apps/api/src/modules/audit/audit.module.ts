import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminAuditLogsController } from './admin-audit-logs.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminAuditLogsController],
  providers: [AuditService, RolesGuard],
  exports: [AuditService],
})
export class AuditModule {}
