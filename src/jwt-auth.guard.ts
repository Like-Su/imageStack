import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_EXPOSE } from './constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  @Inject(Reflector)
  private readonly reflector: Reflector;
  constructor() {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // 该接口是否暴露给非登录用户使用
    const isExpose = this.reflector.getAllAndOverride(IS_EXPOSE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isExpose) {
      return true;
    }

    return super.canActivate(context);
  }
}
