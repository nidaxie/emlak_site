import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { AdminAgentApplicationsController } from './admin-agent-applications.controller';
import { AgentApplicationsController } from './agent-applications.controller';
import { AgentApplicationsService } from './agent-applications.service';
import { AgentDocumentsService } from './agent-documents.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, StorageModule],
  controllers: [AgentApplicationsController, AdminAgentApplicationsController],
  providers: [AgentApplicationsService, AgentDocumentsService, RolesGuard],
})
export class AgentApplicationsModule {}
