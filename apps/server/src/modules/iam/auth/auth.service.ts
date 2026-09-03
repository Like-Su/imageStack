import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as svgCaptcha from 'svg-captcha';
import { compare } from 'bcryptjs';

// Custom Module
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RedisService } from 'src/common/redis/redis.service';
import { EmailService } from './email.service';
import { UserService } from '../user/user.service';
import { RedisKey } from 'src/common/constants';
import { UserStatus } from 'src/prisma/generated/prisma/enums';
import { JwtPayload, RequestUser } from './auth.type';

@Injectable()
export class AuthService {
  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
  ) {
    this.accessTtl = this.configService.getOrThrow<number>('JWT_ACCESS_TTL');
    this.refreshTtl = this.configService.getOrThrow<number>('JWT_REFRESH_TTL');
  }

  // 验证验证码是否正确
  private async verifyCaptcha(captchaId: string, code: string) {
    const key = RedisKey.captcha(captchaId);
    const expected = await this.redisService.get(key);
    // 不管对错都删除
    await this.redisService.del(key);
    if (!expected) throw new BadRequestException('验证码已过期');

    if (expected !== code.trim().toLowerCase())
      throw new BadRequestException('验证码错误');
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

    await this.redisService.set(
      RedisKey.captcha(captchaId),
      captcha.text.toLocaleLowerCase(),
      300,
    );

    return {
      captchaId,
      image: captcha.data,
    };
  }

  private async sendActivateMail(email: string) {
    const token = randomBytes(64).toString('hex');
    const expire = 30 * 60;

    // 存储到 缓存
    // 通过 token 判断 user 是否存在
    await this.redisService.set(RedisKey.activate(token), email, expire);
    // 用户查询 token 是否存在
    await this.redisService.set(RedisKey.activate(email), token, expire);

    // 发送邮件
    await this.emailService.sendEmail(email, token);
  }

  async register(dto: RegisterDto) {
    const { username, email, password, enterPassword, captcha, captchaId } =
      dto;

    await this.verifyCaptcha(captchaId, captcha);

    if (password !== enterPassword)
      throw new BadRequestException('两次密码不一致');

    const user = await this.userService.register(username, email, password);
    // 通过 发送邮件 打开 邮件中的地址来激活账户
    await this.sendActivateMail(email);

    return {
      user,
      message: '发送成功, 请前往邮箱激活账户',
    };
  }

  // 激活
  async activate(token: string) {
    if (!token) throw new BadRequestException('缺少 激活 token');
    const key = RedisKey.activate(token);
    const email = await this.redisService.get(key);
    const cachedToken = await this.redisService.get(RedisKey.activate(email));
    if (!email || cachedToken !== token)
      throw new BadRequestException('激活链接无效或已过期');

    const user = await this.userService.findByEmail(email);
    if (!user || user.deleted) throw new NotFoundException('用户不存在');

    await this.userService.setStatus(user.id, UserStatus.ACTIVE);

    await this.redisService.del(key);

    return true;
  }

  async login(dto: LoginDto) {
    await this.verifyCaptcha(dto.captchaId, dto.captcha);

    const user = await this.userService.findByEmail(dto.email);
    if (!user || user.deleted)
      throw new UnauthorizedException('邮箱或密码错误');

    const passwordOk = await compare(dto.password, user.password);
    if (!passwordOk) throw new UnauthorizedException('邮箱或密码错误');
    if (user.status !== UserStatus.ACTIVE)
      throw new ForbiddenException('账户未激活或已被禁用');

    await this.prismaService.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(user.id);
  }

  // 签发token(token 只存放 sub/type/jti 权限从数据库或缓存取)
  private async issueTokens(userId: string) {
    const accessPayload: JwtPayload = {
      sub: userId,
      type: 'access',
      jti: randomUUID(),
    };
    const refreshPayload: JwtPayload = {
      sub: userId,
      type: 'refresh',
      jti: randomUUID(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, { expiresIn: this.accessTtl }),
      this.jwtService.signAsync(refreshPayload, { expiresIn: this.refreshTtl }),
    ]);

    // refresh 白名单, 过期时间需要设置一致
    await this.redisService.set(
      RedisKey.refresh(userId, refreshPayload.jti),
      refreshToken,
      this.refreshTtl,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtl,
    };
  }

  // 刷新
  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
    } catch (e) {
      throw new UnauthorizedException('refresh token 无效或已过期');
    }
    if (payload.type !== 'refresh')
      throw new UnauthorizedException('无效 refresh token');

    const key = RedisKey.refresh(payload.sub, payload.jti);

    if (!(await this.redisService.get(key))) {
      throw new UnauthorizedException('refresh token 已失效，请重新登录');
    }

    // 轮换
    await this.redisService.del(key);

    const user = await this.userService.getAuthUser(payload.sub);
    if (!user) throw new UnauthorizedException('用户不存在或已禁用');

    return this.issueTokens(payload.sub);
  }

  // 登出
  async logout(user: RequestUser, refreshToken?: string) {
    // 将当前的 access token 拉黑
    const remain = user.tokenExp - Math.floor(Date.now() / 1000);
    if (remain > 0) {
      await this.redisService.set(
        RedisKey.blacklist(user.tokenJti),
        '1',
        remain,
      );
    }

    // 删除 refresh 白名单
    if (refreshToken) {
      const payload = this.jwtService.decode<JwtPayload>(refreshToken);
      if (payload?.type === 'refresh' && payload.sub === user.id) {
        await this.redisService.del(RedisKey.refresh(user.id, payload.jti));
      }
    }
    return true;
  }
}
