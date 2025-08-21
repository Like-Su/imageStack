import { Module } from '@nestjs/common';
import { PictureService } from './picture.service';
import { PictureController } from './picture.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Picture } from './entities/picture.entity';
import { Tags } from './entities/tags.entity';
import { UserModule } from 'src/user/user.module';
import { UniqueShortUrl } from './entities/uniqueShortUrl.entity';
import { ShortLongUrl } from './entities/shortLongUrl.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Picture, Tags, ShortLongUrl, UniqueShortUrl]),
    UserModule,
  ],
  controllers: [PictureController],
  providers: [PictureService],
})
export class PictureModule {}
