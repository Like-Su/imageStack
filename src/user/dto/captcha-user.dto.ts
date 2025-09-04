import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { CAPTCHA_TYPE } from '../../constants';

export class CaptchaUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @IsNotEmpty()
  @IsEnum(CAPTCHA_TYPE)
  type: CAPTCHA_TYPE;
}
