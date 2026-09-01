import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// https://docs.nestjs.com/v6/techniques/authentication#implementing-passport-jwt

interface JwtPayload {
  sub: string;
  account: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(readonly configService: ConfigService) {
    super({
      // 从请求头中提取JWT
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 忽略JWT过期时间
      ignoreExpiration: false,
      // 验证JWT密钥
      secretOrKey: configService.get<string>('JWT_SECRET', 'image-stack'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access')
      throw new UnauthorizedException('无效 access token');
  }
}
