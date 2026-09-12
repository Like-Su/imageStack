import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { trimString } from '../../dto/iam.dto';

export class CreatePermissionDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 80)
  permissionName: string;

  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z][a-z0-9_-]*(?::[a-z][a-z0-9_-]*)+$/)
  permissionCode: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Length(1, 100)
  parentId?: string | null;
}

export class UpdatePermissionDto extends PartialType(CreatePermissionDto, {
  skipNullProperties: false,
}) {}
