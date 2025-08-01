import { PartialType } from '@nestjs/swagger';
import { CreateSystemDto } from './create-system.dto';

export class UpdateSystemDto extends PartialType(CreateSystemDto) {}
