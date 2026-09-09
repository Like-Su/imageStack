import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { MediaJobsService } from './media-jobs.service';
import { MediaProcessorService } from './media-processor.service';

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule],
  providers: [MediaJobsService, MediaProcessorService],
  exports: [MediaJobsService],
})
export class JobsModule {}
