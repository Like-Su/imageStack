import { OmitType } from '@nestjs/mapped-types';
import { LoginUserDto } from './login-user.dto';

export class UpdateUserDto extends OmitType(LoginUserDto, ['captcha']) {
  nickname: string;

  picture: string;
}
