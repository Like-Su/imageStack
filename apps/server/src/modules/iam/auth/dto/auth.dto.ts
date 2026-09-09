import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// 登录
export class LoginDto {
  @IsString()
  email: string;
  @IsString()
  @MinLength(6)
  password: string;
  @IsString()
  captcha: string;
  @IsString()
  captchaId: string;
}

// 注册
export class RegisterDto {
  @IsString()
  username: string;
  @IsString()
  @IsEmail()
  email: string;
  @IsString()
  password: string;
  @IsString()
  enterPassword: string;
  @IsString()
  captcha: string;
  @IsString()
  captchaId: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

// 刷新
export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class SendResetPasswordMailDto {
  @Transform(trimString)
  @IsString()
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @MaxLength(254)
  email: string;

  @Transform(trimString)
  @IsString()
  @Length(4, 4, { message: '请输入 4 位图形验证码' })
  captcha: string;

  @IsUUID('4', { message: '图形验证码标识无效，请重新获取' })
  captchaId: string;
}

// 忘记密码
export class ForgetDto {
  @Transform(trimString)
  @IsString()
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @MaxLength(254)
  email: string;

  @Transform(trimString)
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, {
    message: '请输入邮件中的完整重置验证码',
  })
  emailCode: string;

  @MinLength(8, { message: '新密码至少需要 8 位' })
  @IsByteLength(8, 72, { message: '新密码不能超过 72 字节' })
  @IsString()
  password: string;
}

export class ResetDto extends ForgetDto {}
