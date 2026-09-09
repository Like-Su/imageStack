import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [PrismaModule, StorageModule, JobsModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
