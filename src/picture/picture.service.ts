import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  StreamableFile,
} from '@nestjs/common';
import { CreatePictureDto } from './dto/create-picture.dto';
import { UpdatePictureDto } from './dto/update-picture.dto';
import { Picture } from './entities/picture.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { MinioService } from 'src/minio/minio.service';
import { PICTURE_STATUS } from 'src/constants';
import * as path from 'path';
import * as fs from 'fs/promises';

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
    const dirPath = path.join(`E:\\desk\\图床`);
    const isImage = (fileName: string) => /\.(png|jpg|jpeg)$/i.test(fileName);

    const files = (await fs.readdir(dirPath))
      .filter(isImage)
      .map((fileName) => {
        return {
          fileName: fileName,
          path: path.join(dirPath, fileName),
          name: fileName.match(/^(.+)(?=\.)/)[1],
        };
      })
      .map(async (file) => {
        const picture = new Picture();
        picture.name = file.name;
        picture.description = file.name;
        picture.uri = file.fileName;
        picture.size = (await fs.stat(file.path)).size;
        picture.owner = user1;
        return picture;
      });
    const results = await Promise.all(files);

    await this.pictureRepository.save(results);

    await this.minioService.presignedUrl('GET', 'images', results[0].uri);

    return results;

    // this.pictureRepository.save(results);
    // const results = await Promise.all(Object.keys(images).map(async key => {
    //   const picture1 = new Picture();
    //   picture1.name = images[key];
    //   picture1.uri = images[key];
    //   picture1.description = key;
    //   picture1.owner = user1;
    //   picture1.size = (await this.minioService.statObject('images', images[key])).size;
    //   return picture1;
    // }));
    // //
    //
    // await this.pictureRepository.save(results);
  }

  async uploadFile(pictureInfo: CreatePictureDto) {
    const picture = new Picture();
    console.log(pictureInfo);
    picture.name = pictureInfo.name;
    picture.size = pictureInfo.size;
    picture.uri = pictureInfo.uri;
    picture.owner = pictureInfo.owner;

    await this.pictureRepository.save(picture);
    return picture;
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
    const image = await this.pictureRepository.findOneBy({
      id: imageId,
      owner: { id: userId },
      status: PICTURE_STATUS.NORMAL,
    });

    const fileName = image.name.split('_')[1];
    const stream = await this.minioService.getObject('images', image.uri);

    return new StreamableFile(stream, {
      disposition: `attachment; filename=${Date.now()}-${encodeURIComponent(fileName)}`,
    });
  }

  async listImage(user: User, limit: number, page: number) {
    const images = await this.pictureRepository.find({
      where: { owner: { id: user.id }, status: PICTURE_STATUS.NORMAL },
      take: limit,
      skip: (page - 1) * limit,
      order: { createTime: 'DESC' },
    });

    const parserImages = await Promise.all(
      images.map(async (image) => {
        return {
          ...image,
          uri: await this.minioService.presignedUrl('GET', 'images', image.uri),
        };
      }),
    );

    return parserImages;
  }

  async pictureById(id: number) {
    return await this.pictureRepository.findOne({
      where: {
        id,
        status: PICTURE_STATUS.NORMAL,
      },
      relations: ['owner'],
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
