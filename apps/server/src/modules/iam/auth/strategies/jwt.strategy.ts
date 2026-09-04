import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Custom Module
import { UserService } from '../../user/user.service';
import { RedisService } from 'src/common/redis/redis.service';

// types
import type { JwtPayload, RequestUser } from '../auth.type';
import { RedisKey } from 'src/common/constants';

// https://docs.nestjs.com/v6/techniques/authentication#implementing-passport-jwt

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
  ) {
    super({
      // 从请求头中提取JWT
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 忽略JWT过期时间
      ignoreExpiration: false,
      // 验证JWT密钥(用户没给出则报错)
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    if (payload.type !== 'access' || !payload.sub || !payload.jti)
      throw new UnauthorizedException('无效 access token');

    const blacklisted = await this.redisService.get(
      RedisKey.blacklist(payload.jti),
    );

    // 登出后 token 放入黑名单
    if (blacklisted) {
      throw new UnauthorizedException('用户已 登出');
    }

    if (
      payload.sid &&
      (await this.redisService.get(
        RedisKey.sessionRevoked(payload.sub, payload.sid),
      ))
    ) {
      throw new UnauthorizedException('会话已 登出');
    }

    const currentVersion = await this.userService.getSessionVersion(
      payload.sub,
    );
    const tokenVersion = payload.sv ?? 0;

    if (currentVersion === null || tokenVersion !== currentVersion) {
      throw new UnauthorizedException('会话已失效');
    }

    const user = await this.userService.getAuthUser(payload.sub);

    if (!user) throw new UnauthorizedException('用户不存在或已禁用!');

    return {
      ...user,
      tokenJti: payload.jti,
      tokenExp: payload.exp,
      sessionId: payload.sid,
      sessionVersion: tokenVersion,
    };
  }
}
