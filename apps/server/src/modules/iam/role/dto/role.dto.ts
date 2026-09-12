import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PermissionCodesDto, trimString } from '../../dto/iam.dto';

export class CreateRoleDto extends PartialType(PermissionCodesDto, {
  skipNullProperties: false,
}) {
  @Transform(trimString)
  @IsString()
  @Length(1, 80)
  roleName: string;

  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  @Matches(/^ROLE_[A-Z][A-Z0-9_]*$/)
  roleCode: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn([0, 1])
  status?: number;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto, {
  skipNullProperties: false,
}) {}
