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

export class UpdateProfileDto {
  @Transform(({ obj }: { obj: { username?: unknown } }) =>
    trimString({ value: obj.username }),
  )
  @IsString({ message: '昵称需为 1–80 个字符' })
  @Length(1, 80, { message: '昵称需为 1–80 个字符' })
  username: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(65536, { message: '头像数据过大，请重新选择图片' })
  avatar?: string | null;
}

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
