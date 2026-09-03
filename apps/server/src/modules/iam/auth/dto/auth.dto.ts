import { IsString, IsEmail, MinLength, IsOptional } from 'class-validator';

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
