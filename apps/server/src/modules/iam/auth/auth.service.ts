import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as svgCaptcha from 'svg-captcha';
import { compare } from 'bcryptjs';

// Custom Module
import {
  LoginDto,
  RegisterDto,
  SendResetPasswordMailDto,
} from './dto/auth.dto';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RedisService } from 'src/common/redis/redis.service';
import { EmailService } from './email.service';
import { UserService } from '../user/user.service';
import { RedisKey } from 'src/common/constants';
import { UserStatus } from 'src/prisma/generated/prisma/enums';
import { JwtPayload, RequestUser } from './auth.type';
import { withSerializable } from 'src/common/prisma/transaction';
import {
  PASSWORD_RESET_COOLDOWN_SECONDS,
  PASSWORD_RESET_INVALID_MESSAGE,
  PASSWORD_RESET_TTL_SECONDS,
} from 'src/common/constants/auth';
import { BusinessException } from 'src/common/exceptions/business.exception';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
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
    const expected = await this.redisService.getDel(key);
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

  private async sendActivateMail(email: string, sessionVersion: number) {
    const token = randomBytes(64).toString('hex');
    const expire = 30 * 60;

    // 存储到 缓存
    // 通过 token 判断 user 是否存在
    await this.redisService.set(
      RedisKey.activate(token),
      JSON.stringify({ email, sessionVersion }),
      expire,
    );
    // 用户查询 token 是否存在
    await this.redisService.set(RedisKey.activate(email), token, expire);

    // 发送邮件
    await this.emailService.sendEmail(email, token, 'site', expire);
  }

  async register(dto: RegisterDto) {
    const { username, email, password, enterPassword, captcha, captchaId } =
      dto;

    await this.verifyCaptcha(captchaId, captcha);

    if (password !== enterPassword)
      throw new BadRequestException('两次密码不一致');

    const user = await this.userService.register(username, email, password);
    // 通过 发送邮件 打开 邮件中的地址来激活账户
    await this.sendActivateMail(email, user.sessionVersion);

    return {
      user: { id: user.id, username: user.username, email: user.email },
      message: '发送成功, 请前往邮箱激活账户',
    };
  }

  // 激活
  async activate(token: string) {
    if (!token) throw new BadRequestException('缺少 激活 token');
    const key = RedisKey.activate(token);
    const stored = await this.redisService.get(key);
    if (!stored) throw new BadRequestException('激活链接无效或已过期');
    let email = stored;
    let sessionVersion = 0;
    if (stored.startsWith('{')) {
      const activation: unknown = JSON.parse(stored);
      if (
        !activation ||
        typeof activation !== 'object' ||
        !('email' in activation) ||
        typeof activation.email !== 'string' ||
        !('sessionVersion' in activation) ||
        typeof activation.sessionVersion !== 'number' ||
        !Number.isSafeInteger(activation.sessionVersion) ||
        activation.sessionVersion < 0
      )
        throw new BadRequestException('激活链接无效或已过期');
      email = activation.email;
      sessionVersion = activation.sessionVersion;
    }
    const cachedToken = await this.redisService.get(RedisKey.activate(email));
    if (!email || cachedToken !== token)
      throw new BadRequestException('激活链接无效或已过期');

    const user = await this.userService.findByEmail(email);
    if (!user || user.deleted) throw new NotFoundException('用户不存在');

    await this.userService.activateUser(user.id, sessionVersion);

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
    return this.issueTokens(user.id, user.sessionVersion);
  }

  // 签发token(token 只存放 sub/type/jti 权限从数据库或缓存取)
  private async issueTokens(
    userId: string,
    sessionVersion: number,
    sessionId: string = randomUUID(),
  ) {
    const currentVersion = await this.userService.getSessionVersion(userId);
    if (currentVersion === null || currentVersion !== sessionVersion)
      throw new UnauthorizedException('会话已失效，请重新登录');

    const accessPayload: JwtPayload = {
      sub: userId,
      type: 'access',
      jti: randomUUID(),
      sid: sessionId,
      sv: sessionVersion,
    };
    const refreshPayload: JwtPayload = {
      sub: userId,
      type: 'refresh',
      jti: randomUUID(),
      sid: sessionId,
      sv: sessionVersion,
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

    if (payload.type !== 'refresh' || !payload.sub || !payload.jti) {
      throw new UnauthorizedException('无效 refresh token');
    }

    // 原子操作
    const currentVersion = await this.userService.getSessionVersion(
      payload.sub,
    );
    const tokenVersion = payload.sv ?? 0;

    if (currentVersion === null || tokenVersion !== currentVersion) {
      throw new UnauthorizedException('无效 refresh token');
    }

    const key = RedisKey.refresh(payload.sub, payload.jti);

    const consumed = await this.redisService.consume(key, refreshToken);

    if (!consumed) {
      throw new UnauthorizedException('refresh token 已使用或失效');
    }

    const user = await this.userService.getAuthUser(
      payload.sub,
      currentVersion,
    );

    if (!user) throw new UnauthorizedException('用户不存在或已禁用');

    return this.issueTokens(payload.sub, tokenVersion, payload.sid);
  }

  // 登出
  async logout(user: RequestUser, refreshToken?: string) {
    // 将当前的 access token 拉黑
    const now = Math.floor(Date.now() / 1000);
    const accessRemain = Math.max(0, user.tokenExp - now);

    if (accessRemain > 0) {
      await this.redisService.set(
        RedisKey.blacklist(user.tokenJti),
        '1',
        accessRemain,
      );
    }

    // 删除 refresh 白名单
    if (user.sessionId) {
      await this.redisService.set(
        RedisKey.sessionRevoked(user.id, user.sessionId),
        '1',
        Math.max(this.refreshTtl, accessRemain),
      );
    }

    return true;
  }

  async logoutAll(user: RequestUser) {
    await withSerializable(this.prismaService, async (tx) => {
      const version = this.userService.bumpSessionVersion(user.id);
      if (version === null) {
        throw new UnauthorizedException('用户不存在');
      }
      return version;
    });
    return true;
  }

  async sendResetPasswordMail(dto: SendResetPasswordMailDto) {
    await this.verifyCaptcha(dto.captchaId, dto.captcha);

    const email = dto.email.trim();
    const cooldownKey = RedisKey.forgetPasswordCooldown(email);
    const reserved = await this.redisService.setIfAbsent(
      cooldownKey,
      randomUUID(),
      PASSWORD_RESET_COOLDOWN_SECONDS,
    );

    if (!reserved) {
      const retryAfter = Math.max(1, await this.redisService.ttl(cooldownKey));
      throw new BusinessException(
        'PASSWORD_RESET_COOLDOWN',
        `请求过于频繁，请在 ${retryAfter} 秒后重试`,
        { retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const response = {
      message:
        '请求已受理。若账户可用，请留意密码重置邮件；未收到请稍后重试或联系管理员。',
      expiresIn: PASSWORD_RESET_TTL_SECONDS,
      retryAfter: PASSWORD_RESET_COOLDOWN_SECONDS,
    };
    const user = await this.userService.findByEmail(email);
    if (!user || user.deleted || user.status !== UserStatus.ACTIVE)
      return response;

    const code = randomBytes(32).toString('hex');
    const codeHash = this.hashPasswordResetCode(
      user.id,
      user.sessionVersion,
      code,
    );
    const key = RedisKey.forgetPassword(email);
    try {
      await this.redisService.set(key, codeHash, PASSWORD_RESET_TTL_SECONDS);
      await this.emailService.sendEmail(
        user.email,
        code,
        'forget',
        PASSWORD_RESET_TTL_SECONDS,
      );
    } catch (error) {
      const failureCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : 'UNKNOWN';
      this.logger.error({
        message: '密码重置邮件准备或投递失败',
        userId: user.id,
        code: failureCode,
      });
      try {
        await this.redisService.consume(key, codeHash);
      } catch {
        this.logger.error(`密码重置验证码清理失败，用户 ID：${user.id}`);
      }
    }

    return response;
  }

  async forgetPassword(email: string, emailCode: string, newPassword: string) {
    const normalizedEmail = email.trim();
    const user = await this.userService.findByEmail(normalizedEmail);
    if (!user || user.deleted || user.status !== UserStatus.ACTIVE)
      throw new BusinessException(
        'PASSWORD_RESET_INVALID',
        PASSWORD_RESET_INVALID_MESSAGE,
      );

    const consumed = await this.redisService.consume(
      RedisKey.forgetPassword(normalizedEmail),
      this.hashPasswordResetCode(
        user.id,
        user.sessionVersion,
        emailCode.trim().toLowerCase(),
      ),
    );
    if (!consumed)
      throw new BusinessException(
        'PASSWORD_RESET_INVALID',
        PASSWORD_RESET_INVALID_MESSAGE,
      );

    await this.userService.resetPassword(
      user.id,
      newPassword,
      user.sessionVersion,
    );

    return true;
  }

  private hashPasswordResetCode(
    userId: string,
    sessionVersion: number,
    code: string,
  ) {
    return createHash('sha256')
      .update(`${userId}:${sessionVersion}:${code}`)
      .digest('hex');
  }
}
