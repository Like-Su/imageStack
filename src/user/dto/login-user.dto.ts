import { applyDecorators } from '@nestjs/common';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class LoginUserDto {
  @EmailValidators()
  email: string;
  @PasswordValidators()
  password: string;
  @CaptchaValidators()
  captcha: string;
}

function EmailValidators() {
  return applyDecorators(IsEmail(), IsNotEmpty({ message: '邮箱不能为空' }));
}

function PasswordValidators() {
  return applyDecorators(
    IsNotEmpty({ message: '密码不能为空' }),
    MinLength(6, { message: '密码不能少于 6 位' }),
  );
}

function CaptchaValidators() {
  return applyDecorators(
    IsNotEmpty({ message: '验证码不能为空' }),
    MinLength(4, { message: '验证码格式错误' }),
  );
}
