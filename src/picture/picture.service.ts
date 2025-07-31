import { Injectable } from '@nestjs/common';
import { CreatePictureDto } from './dto/create-picture.dto';
import { UpdatePictureDto } from './dto/update-picture.dto';

@Injectable()
export class PictureService {
  create(createPictureDto: CreatePictureDto) {
    return 'This action adds a new picture';
  }

  findAll() {
    return `This action returns all picture`;
  }

  findOne(id: number) {
    return `This action returns a #${id} picture`;
  }

  update(id: number, updatePictureDto: UpdatePictureDto) {
    return `This action updates a #${id} picture`;
  }

  remove(id: number) {
    return `This action removes a #${id} picture`;
  }
}
