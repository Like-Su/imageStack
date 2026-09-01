import { IsString } from 'class-validator';

// 登录
export class LoginDto {
  @IsString()
  account: string;
  @IsString()
  password: string;
  @IsString()
  captcha: string;
}

// 注册
export class RegisterDto {
  @IsString()
  username: string;
  @IsString()
  account: string;
  @IsString()
  password: string;
  @IsString()
  enterPassword: string;
  @IsString()
  captcha: string;
}

// 刷新
export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
