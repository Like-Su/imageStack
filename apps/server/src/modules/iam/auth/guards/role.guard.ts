import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

import { RequestUser } from '../auth.type';
import { ROLES_KEY } from '../decorators/roles-permissions.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 没有设置权限
    if (!isRoles?.length) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: RequestUser }>();
    // JwtAuthGuard 在前面已经拦截
    if (!user) throw new UnauthorizedException('未登录');

    if (!isRoles.includes(user.roleCode)) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}
