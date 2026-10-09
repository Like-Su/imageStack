import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AiController } from './ai.controller';
import { AiIndexService } from './ai-index.service';
import { AiVisionService } from './ai-vision.service';
import { AiWorkerService } from './ai-worker.service';

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule],
  controllers: [AiController],
  providers: [AiIndexService, AiVisionService, AiWorkerService],
  exports: [AiIndexService],
})
export class AiModule {}
