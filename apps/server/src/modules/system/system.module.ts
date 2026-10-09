import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { StorageModule } from '../../infrastructure/storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [SystemService],
  controllers: [SystemController],
})
export class SystemModule {}
