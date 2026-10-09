import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AssetsModule } from '../assets/assets.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [PrismaModule, AssetsModule, StorageModule],
  controllers: [SharesController],
  providers: [SharesService],
})
export class SharesModule {}
