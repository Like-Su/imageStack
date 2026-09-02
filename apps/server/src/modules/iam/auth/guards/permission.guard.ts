import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { PERMISSIONS_KEY } from '../decorators/roles-permissions.decorator';
import { User } from '../auth.type';
import { RoleCode } from 'src/common/constants';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const permissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permissions?.length) return true;

    const req = context.switchToHttp().getRequest<{ user: User }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('权限不足');
    // 管理员直接放行
    if (user.roles.includes(RoleCode.ADMIN)) return true;

    const ownerPermission = new Set(user.permissions ?? []);
    const isPermission = permissions.some((permission) =>
      ownerPermission.has(permission),
    );

    if (!isPermission) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}
