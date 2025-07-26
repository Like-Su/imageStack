import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { UN_NEED_LOGIN } from './constants';
import { Role } from './user/entities/role.entity';
import { Permission } from './user/entities/permission.entity';
import { JwtService } from '@nestjs/jwt';

// 扩展 Request
declare module 'express' {
  interface Request {
    user: {
      userId: number;
      nickname: string;
      email: string;
      roles: Role[];
      permissions: Permission[];
    };
  }
}

// 拦截需要登录的接口
@Injectable()
export class LoginGuard implements CanActivate {
  @Inject(Reflector)
  private readonly reflector: Reflector;
  @Inject(JwtService)
  private readonly jwtService: JwtService;

  canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest(),
      needLogin = this.reflector.getAllAndOverride(UN_NEED_LOGIN, [
        context.getClass(),
        context.getHandler(),
      ]);

    // 若无需登录 表示 无需拦截 => /user/login, /user/register, /user/register
    if (needLogin) return true;

    const authorization: string | string[] =
      request.headers.authorization?.split(' ');

    if (authorization.length === 0 || !authorization) {
      throw new UnauthorizedException('无权访问该接口, 请登录');
    }

    try {
      const auth = authorization.pop();
      const token = this.jwtService.verify(auth);
      // 将 token 的 信息绑定到 request 上
      request.user = token.user;

      return true;
    } catch (e) {
      throw new UnauthorizedException('token 无效, 请重新登陆');
    }
  }
}
