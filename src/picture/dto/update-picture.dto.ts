import { PartialType } from '@nestjs/swagger';
import { CreatePictureDto } from './create-picture.dto';

export class UpdatePictureDto extends PartialType(CreatePictureDto) {}
