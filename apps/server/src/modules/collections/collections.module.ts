import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AssetsModule } from '../assets/assets.module';
import { AlbumsController } from './albums.controller';
import { AlbumsService } from './albums.service';
import { AssetTagsController } from './asset-tags.controller';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [PrismaModule, AssetsModule],
  controllers: [AlbumsController, TagsController, AssetTagsController],
  providers: [AlbumsService, TagsService],
})
export class CollectionsModule {}
