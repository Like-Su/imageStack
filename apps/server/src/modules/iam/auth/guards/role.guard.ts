import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

import { User } from '../auth.type';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isRoles = this.reflector.getAllAndOverride('ROLES', [
      context.getHandler(),
      context.getClass(),
    ]);

    // 没有设置权限
    if (!isRoles?.length) return true;

    const request = context.switchToHttp().getRequest<{ user: User }>();
    const user = request.user;

    if (!user?.roles?.length) throw new ForbiddenException('权限不足');

    const hasRole = user.roles.some((role) => isRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}
