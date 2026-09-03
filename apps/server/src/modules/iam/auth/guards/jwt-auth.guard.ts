import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

// Custom Module
import { IS_OPEN_KEY } from '../decorators/open.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isOpen = this.reflector.getAllAndOverride<boolean>(IS_OPEN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isOpen) return true;

    // 调用 passport 的 authen
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: any, info: any): TUser {
    if (err) throw err;
    if (!user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('token 已过期');
      }
      throw new UnauthorizedException('未登录或 token 无效');
    }
    return user;
  }
}
