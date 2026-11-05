import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { FilesController } from './files.controller';
import { LocalObjectStorage } from './local-object-storage';
import { PublicFilesService } from './public-files.service';
import { StorageService } from './storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [FilesController],
  providers: [LocalObjectStorage, StorageService, PublicFilesService],
  exports: [StorageService],
})
export class StorageModule {}
