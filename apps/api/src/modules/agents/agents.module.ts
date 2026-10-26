import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PropertiesModule } from '../properties/properties.module';
import { StorageModule } from '../storage/storage.module';
import { AdminAgentsController } from './admin-agents.controller';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    StorageModule,
    PropertiesModule,
  ],
  controllers: [AgentsController, AdminAgentsController],
  providers: [AgentsService, RolesGuard],
})
export class AgentsModule {}
