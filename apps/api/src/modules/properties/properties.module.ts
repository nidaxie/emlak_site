import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { AdminPropertiesController } from './admin-properties.controller';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PropertyImagesService } from './property-images.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, StorageModule],
  controllers: [PropertiesController, AdminPropertiesController],
  providers: [PropertiesService, PropertyImagesService, RolesGuard],
  exports: [PropertiesService],
})
export class PropertiesModule {}
