import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as svgCaptcha from 'svg-captcha';

// Custom Module
import { RegisterDto } from './dto/auth.dto';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async captcha() {
    // 生成 captchaId 防止 前端 重复提交 或 重复使用
    const captchaId = randomUUID();

    const captcha = svgCaptcha.create({
      size: 4,
      ignoreChars: '0oO1ilI',
      noise: 3,
      color: true,
      background: '#FFF',
    });

    const code = captcha.text.toLowerCase();

    await this.redisService.set(`captcha:${captchaId}`, code, 300);
  }

  async register(dto: RegisterDto) {}
}
