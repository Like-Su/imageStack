import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AiModule } from '../ai/ai.module';
import { MediaJobsService } from './media-jobs.service';
import { MediaProcessorService } from './media-processor.service';
import { VideoProcessorService } from './video-processor.service';

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule, AiModule],
  providers: [MediaJobsService, MediaProcessorService, VideoProcessorService],
  exports: [MediaJobsService, VideoProcessorService],
})
export class JobsModule {}
