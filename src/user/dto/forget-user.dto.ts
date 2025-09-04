import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class ForgetUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @IsNotEmpty()
  @MinLength(4)
  captcha: string;
  @IsNotEmpty()
  password: string;
}

// 059523460000
