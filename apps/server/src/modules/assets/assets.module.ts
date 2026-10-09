import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetWorkspaceService } from './asset-workspace.service';
import { ThumbnailsService } from './thumbnails.service';
import { UserModule } from '../iam/user/user.module';
import { MediaStreamController } from './media-stream.controller';
import { MediaStreamService } from './media-stream.service';
import { AssetDownloadsService } from './asset-downloads.service';

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule, JobsModule, UserModule],
  controllers: [AssetsController, MediaStreamController],
  providers: [
    AssetsService,
    ThumbnailsService,
    AssetWorkspaceService,
    MediaStreamService,
    AssetDownloadsService,
  ],
  exports: [AssetsService],
})
export class AssetsModule {}
