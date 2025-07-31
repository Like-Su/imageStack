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
import { NEED_PERMISSIONS } from './constants';

@Injectable()
export class PermissionGuard implements CanActivate {
  @Inject(Reflector)
  private readonly reflector: Reflector;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    // 表明通过 loginGuard 校验
    if (!request.user) {
      return true;
    }

    const targetPermissions = this.reflector.getAllAndOverride(
        NEED_PERMISSIONS,
        [context.getClass(), context.getHandler()],
      ),
      permissions = request.user.permissions;

    if (!targetPermissions) {
      return true;
    }

    for (let i = 0; i < targetPermissions.length; i++) {
      const currentPermissionCode = targetPermissions[i],
        isTargetPermissionInUserPermission = permissions.some(
          (per) => per.code === currentPermissionCode,
        );
      console.log(isTargetPermissionInUserPermission);
      if (!isTargetPermissionInUserPermission) {
        throw new UnauthorizedException('无该接口访问权限');
      }
    }

    return true;
  }
}
