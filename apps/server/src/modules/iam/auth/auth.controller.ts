import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { RegisterDto } from './dto/auth.dto';
import { AuthService } from './auth.service';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 需要限流
  // captcha
  @Get('captcha')
  async captcha(@Res() res: Response) {
    return await this.authService.captcha();
  }

  // 注册
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return await this.authService.register(registerDto);
  }
}
