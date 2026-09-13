import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { CollectionsModule } from '../collections/collections.module';
import { VideoSummariesModule } from '../video-summaries/video-summaries.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { UploadPartsService } from './upload-parts.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    JobsModule,
    VideoSummariesModule,
    CollectionsModule,
  ],
  controllers: [UploadsController],
  providers: [UploadsService, UploadPartsService],
})
export class UploadsModule {}
