import { OmitType } from '@nestjs/mapped-types';
import { LoginUserDto } from './login-user.dto';

export class UpdateUserDto {
  nickname: string;

  picture: string;
}
