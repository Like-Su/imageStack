import { Module } from '@nestjs/common';
import { PictureService } from './picture.service';
import { PictureController } from './picture.controller';

@Module({
  controllers: [PictureController],
  providers: [PictureService],
})
export class PictureModule {}
