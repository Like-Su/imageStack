import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

// Custom Module
import {
  ForgetDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetDto,
} from './dto/auth.dto';
import { AuthService } from './auth.service';
import { Open } from './decorators/open.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequestUser } from './auth.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // captcha
  @Open()
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
  @Open()
  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // 注册
  @Open()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return await this.authService.register(registerDto);
  }

  // 忘记密码
  @Open()
  @Post('forget')
  async forget(@Body() forgetDto: ForgetDto) {
    return this.authService.forgetPassword(
      forgetDto.email,
      forgetDto.emailCode,
      forgetDto.password,
    );
  }

  // 重置密码
  @Open()
  @Post('reset')
  async reset(@Body() resetDto: ResetDto) {
    return this.authService.forgetPassword(
      resetDto.email,
      resetDto.emailCode,
      resetDto.password,
    );
  }

  // 激活账户
  @Open()
  @Get('verify-activate')
  verifyActivate(@Query('token') token: string) {
    return this.authService.activate(token);
  }

  // 无感登录
  @Open()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // 登出
  @Post('logout')
  logout(@CurrentUser() user: RequestUser, @Body() dto: LogoutDto) {
    return this.authService.logout(user, dto.refreshToken);
  }

  @Post('logout-all')
  logoutAll(@CurrentUser() user: RequestUser) {
    return this.authService.logoutAll(user);
  }
}
