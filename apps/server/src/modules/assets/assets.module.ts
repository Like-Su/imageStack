import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetWorkspaceService } from './asset-workspace.service';
import { ThumbnailsService } from './thumbnails.service';
import { UserModule } from '../iam/user/user.module';
import { MediaStreamController } from './media-stream.controller';
import { MediaStreamService } from './media-stream.service';

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule, JobsModule, UserModule],
  controllers: [AssetsController, MediaStreamController],
  providers: [
    AssetsService,
    ThumbnailsService,
    AssetWorkspaceService,
    MediaStreamService,
  ],
  exports: [AssetsService],
})
export class AssetsModule {}
