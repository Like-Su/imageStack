import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UserStatus } from 'src/prisma/generated/prisma/enums';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(6)
  password: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

// 删除用户
export class DeleteUserDto {
  @IsString()
  id: string;
}

// 用户修改状态
export class UserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
