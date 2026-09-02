import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RefreshTokenDto, RegisterDto } from './dto/auth.dto';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('verify')
  async verify() {
    return this.authService.test();
  }

  // captcha
  @Get('captcha')
  // 局部限流
  @Throttle({
    default: {
      ttl: 60_000,
      limit: 10,
    },
  })
  async captcha() {
    return await this.authService.captcha();
  }

  // 登录
  @Post('login')
  async login() {}

  // 注册
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return await this.authService.register(registerDto);
  }

  // 忘记密码
  @Post('forget')
  async forget() {}

  // 重置密码
  @Post('reset')
  async reset() {}

  // 激活账户
  @Get('verify-activate')
  async verifyActivate(@Param('token') token: string) {}

  // 无感登录
  @Post('refresh')
  refresh(@Body() RefreshTokenDto) {}

  // 登出
  @Post('logout')
  logout() {}

  // 获取自己的信息
  @Get('self')
  self() {}
}
