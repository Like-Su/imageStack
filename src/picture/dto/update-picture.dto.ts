import { PartialType } from '@nestjs/swagger';
import { CreatePictureDto } from './create-picture.dto';
import { OmitType, PickType } from '@nestjs/mapped-types';
import { PICTURE_STATUS } from 'src/constants';

export class UpdatePictureDto extends PickType(CreatePictureDto, ['name']) {
  description: string;
  status: PICTURE_STATUS;
}
