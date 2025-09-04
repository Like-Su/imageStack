import { PartialType } from '@nestjs/swagger';
import { CreatePictureDto } from './create-picture.dto';
import { OmitType, PickType } from '@nestjs/mapped-types';
import { PICTURE_STATUS } from 'src/constants';
import { IsArray } from 'class-validator';

export class UpdatePictureDto extends PickType(CreatePictureDto, ['name']) {
  description: string;
  @IsArray()
  tags: number[];
  status: PICTURE_STATUS;
}
