import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreatePictureDto } from './dto/create-picture.dto';
import { UpdatePictureDto } from './dto/update-picture.dto';
import { Picture } from './entities/picture.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class PictureService {
  @InjectRepository(Picture)
  private readonly pictureRepository: Repository<Picture>;

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

  async listImage(user: User) {
    const images = await this.pictureRepository.find({
      where: { owner: user }
    });

    return images;
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
