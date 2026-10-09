import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { RabbitMqModule } from '../../infrastructure/rabbitmq/rabbitmq.module';
import { AiModule } from '../ai/ai.module';
import { MediaJobsService } from './media-jobs.service';
import { MediaProcessorService } from './media-processor.service';
import { VideoProcessorService } from './video-processor.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    StorageModule,
    RabbitMqModule,
    AiModule,
  ],
  providers: [MediaJobsService, MediaProcessorService, VideoProcessorService],
  exports: [MediaJobsService, VideoProcessorService],
})
export class JobsModule {}
