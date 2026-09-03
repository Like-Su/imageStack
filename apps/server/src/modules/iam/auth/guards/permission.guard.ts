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

    const { user } = context.switchToHttp().getRequest<{ user: User }>();
    if (!user) throw new ForbiddenException('未登录');

    // 管理员直接放行
    if (user.roleCode === RoleCode.ADMIN) return true;

    const ownerd = new Set(user.permissions ?? []);
    // 满足任意一个即可
    const allowed = permissions.some((permission) => ownerd.has(permission));

    if (!allowed) throw new ForbiddenException('权限不足');

    return true;
  }
}
