import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import {
  IsByteLength,
  IsEmail,
  IsEnum,
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { UserStatus } from '../../../../prisma/generated/prisma/enums';
import { IamPageDto, PermissionCodesDto, trimString } from '../../dto/iam.dto';

export class CreateUserDto extends PartialType(PermissionCodesDto, {
  skipNullProperties: false,
}) {
  @Transform(trimString)
  @IsString()
  @Length(1, 80)
  username: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @IsByteLength(8, 72)
  password: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  roleId?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto, {
  skipNullProperties: false,
}) {}

export class ListUsersDto extends IamPageDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  roleId?: string;
}

export class DeleteUserDto {
  @IsString()
  @Length(1, 100)
  id: string;
}
