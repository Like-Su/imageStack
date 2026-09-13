import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AssetsModule } from '../assets/assets.module';
import { StorageModule } from '../storage/storage.module';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [PrismaModule, AssetsModule, StorageModule],
  controllers: [SharesController],
  providers: [SharesService],
})
export class SharesModule {}
