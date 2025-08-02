import { Module } from '@nestjs/common';
import { PictureService } from './picture.service';
import { PictureController } from './picture.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Picture } from './entities/picture.entity';
import { Tags } from './entities/tags.entity';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Picture, Tags]), UserModule],
  controllers: [PictureController],
  providers: [PictureService],
})
export class PictureModule {}
