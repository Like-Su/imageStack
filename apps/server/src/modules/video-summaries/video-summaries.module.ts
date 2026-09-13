import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { VideoSummariesController } from './video-summaries.controller';
import { VideoSummariesService } from './video-summaries.service';
import { VideoTranscriptionService } from './video-transcription.service';
import { VideoSummaryLlmService } from './video-summary-llm.service';
import { VideoSummaryWorkerService } from './video-summary-worker.service';
import { VideoSummaryEventsService } from './video-summary-events.service';

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule, JobsModule],
  controllers: [VideoSummariesController],
  providers: [
    VideoSummariesService,
    VideoTranscriptionService,
    VideoSummaryLlmService,
    VideoSummaryWorkerService,
    VideoSummaryEventsService,
  ],
  exports: [VideoSummariesService],
})
export class VideoSummariesModule {}
