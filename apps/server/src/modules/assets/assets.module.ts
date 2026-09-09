import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetWorkspaceService } from './asset-workspace.service';
import { ThumbnailsService } from './thumbnails.service';

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule, JobsModule],
  controllers: [AssetsController],
  providers: [AssetsService, ThumbnailsService, AssetWorkspaceService],
  exports: [AssetsService],
})
export class AssetsModule {}
