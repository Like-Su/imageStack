import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as svgCaptcha from 'svg-captcha';

// Custom Module
import { RegisterDto } from './dto/auth.dto';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RedisService } from 'src/common/redis/redis.service';
import { EmailService } from './email.service';
import { UserService } from '../user/user.service';

const EMAIL_ACTIVATE_TOKEN = 'email_activate_token';
const USER_ACTIVATE_TOKEN = 'user_activate_token';
@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
  ) {}

  async test() {
    return await this.emailService.sendEmail('123', '123');
  }

  // 验证验证码是否正确
  private async verify(captchaId: string, code: string) {
    const key = `captcha:${captchaId}`;
    const value = await this.redisService.get(key);

    if (!value) throw new NotFoundException('验证码不存在');

    const valid = value.toLocaleLowerCase() === code.toLowerCase();

    if (!valid) {
      throw new BadRequestException('验证码错误');
    }

    await this.redisService.del(key);

    return valid;
  }

  // 生成 svg 图形验证码
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

    return {
      captchaId,
      image: captcha.data,
    };
  }

  private async createToken(email: string) {
    const token = randomBytes(64).toString('hex');
    const expire = 60 * 5;

    // 存储到 缓存
    // 通过 token 判断 user 是否存在
    await this.redisService.set(token, JSON.stringify({ email }), expire);
    // 用户查询 token 是否存在
    await this.redisService.set(email, JSON.stringify({ token }), expire);
  }

  async register(dto: RegisterDto) {
    const { username, email, password, enterPassword, captcha, captchaId } =
      dto;

    const validCaptcha = await this.verify(captchaId, captcha);

    if (validCaptcha) throw new BadRequestException('验证码错误');

    if (password !== enterPassword)
      throw new BadRequestException('两次密码不一致');

    // 查询邮箱是否注册
    const validEmail = await this.userService.findByEmail(email);

    if (validEmail) throw new BadRequestException('邮箱已注册');

    // 通过 发送邮件 打开 邮件中的地址来激活账户
  }
}
