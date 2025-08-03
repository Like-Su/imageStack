import { HttpException, HttpStatus, Inject, Injectable, StreamableFile } from '@nestjs/common';
import { CreatePictureDto } from './dto/create-picture.dto';
import { UpdatePictureDto } from './dto/update-picture.dto';
import { Picture } from './entities/picture.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { MinioService } from 'src/minio/minio.service';
import { PICTURE_STATUS } from 'src/constants';

@Injectable()
export class PictureService {
  @InjectRepository(Picture)
  private readonly pictureRepository: Repository<Picture>;
  @Inject(UserService)
  private readonly userService: UserService;
  @Inject(MinioService)
  private readonly minioService: MinioService;

  async initData() {
    const user1 = await this.userService.findUserById(1);
    const images = {
      cs: '2ef2c9238688a8ff9ee581eab55e86b5_720w.webp',
      rust: '43475918089e04c256ea8edc052ad62dcb5dea4a.webp',
      obj: '650f7ccaed840018c561f0b4afac9ef9ba030024_2_517x291.jpg',
      rust1: '9ff0a8f478e6f7a20c1c4d301563937abf18a596_2_1035x715.webp',
      net: 'photo_2025-07-14_19-59-40.jpg',
      house: 'photo_2025-07-14_19-59-41 (3).jpg',
      fly: 'photo_2025-07-14_19-59-41.jpg',
      pic: 'photo_2025-07-14_19-59-42.jpg'
    }

    const results = await Promise.all(Object.keys(images).map(async key => {
      const picture1 = new Picture();
      picture1.name = images[key];
      picture1.uri = images[key];
      picture1.description = key;
      picture1.owner = user1;
      picture1.size = (await this.minioService.statObject('images', images[key])).size;
      return picture1;
    }));


    await this.pictureRepository.save(results);
  }

  async uploadFile(pictureInfo: CreatePictureDto) {
    const picture = new Picture();
    picture.name = pictureInfo.name;
    picture.size = pictureInfo.size;
    picture.uri = pictureInfo.uri;
    picture.owner = pictureInfo.owner;

    await this.pictureRepository.save(picture);
  }

  async updateImageInfo(id: number, updatePictureDto: UpdatePictureDto) {
    const image = await this.pictureById(id);
    if (updatePictureDto.name) {
      image.name = updatePictureDto.name;
    }
    if (updatePictureDto.description) {
      image.description = updatePictureDto.description;
    }
    if (updatePictureDto.status) {
      image.status = updatePictureDto.status;
    }
    this.pictureRepository.save(image);
  }

  async download(userId: number, imageId: number) {
    const image = await this.pictureRepository.findOneBy({ id: imageId, owner: { id: userId }, status: PICTURE_STATUS.NORMAL });
    const stream = await this.minioService.getObject('images', image.uri);

    return new StreamableFile(stream, {
      disposition: `attachment; filename=${Date.now()}-${image.name}`
    });
  }

  async listImage(user: User, limit: number, page: number) {
    const images = await this.pictureRepository.find({
      where: { owner: { id: user.id }, status: PICTURE_STATUS.NORMAL },
      take: limit,
      // skip: limit
    });

    const parserImages = await Promise.all(images.map(async image => {
      return {...image, uri: await this.minioService.presignedUrl('GET', 'images', image.uri)};
    }));

    return parserImages;
  }

  async pictureById(id: number) {
    return await this.pictureRepository.findOneBy({
      id
    });
  }

  // 检查用户是否有该图片
  async existImage(userId: number, imageId: number) {
    const image = await this.pictureById(imageId);

    if (userId !== image.owner.id) {
      throw new HttpException('图片不存在', HttpStatus.ACCEPTED);
    }
  }
}
