import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/roles-permissions.decorator';
import { User } from '../auth.type';
import { RoleCode } from 'src/common/constants';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type { Prisma } from '../../../../prisma/generated/prisma/client';
import { albumWhere } from '../../../collections/album-scope';
import {
  SHARED_ALBUM_ACCESS_KEY,
  type SharedAlbumAccess,
} from '../decorators/shared-album-access.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permissions?.length) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const { user } = request;
    if (!user) throw new ForbiddenException('未登录');

    // 管理员直接放行
    if (user.roleCode === RoleCode.ADMIN) return true;

    const ownerd = new Set(user.permissions ?? []);
    // 满足任意一个即可
    const allowed = permissions.some((permission) => ownerd.has(permission));

    if (allowed) return true;
    const access = this.reflector.getAllAndOverride<SharedAlbumAccess>(
      SHARED_ALBUM_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (access && (await this.hasSharedAccess(request, user.id, access)))
      return true;
    throw new ForbiddenException('权限不足');
  }

  private async hasSharedAccess(
    request: Request,
    userId: string,
    access: SharedAlbumAccess,
  ) {
    let target: Prisma.AlbumWhereInput;
    if (access.source === 'upload' && typeof request.params.id === 'string') {
      target = { uploadSessions: { some: { id: request.params.id, userId } } };
    } else {
      const body = request.body as { albumId?: unknown } | undefined;
      const identifier =
        access.source === 'upload'
          ? body?.albumId
          : access.source === 'album-query'
            ? request.query.albumId
            : request.params.id;
      if (typeof identifier !== 'string' || !identifier) return false;
      target =
        access.source === 'asset'
          ? {
              assets: {
                some: { assetId: identifier, asset: { deleted: false } },
              },
            }
          : { id: identifier };
    }
    const membership: Prisma.AlbumMemberWhereInput = {
      userId,
      ...(access.permission === 'addAssets' ? { canAdd: true } : {}),
      ...(access.permission === 'edit' ? { canEdit: true } : {}),
      ...(access.permission === 'removeAssets' ? { canRemove: true } : {}),
    };
    const permission: Prisma.AlbumWhereInput =
      access.permission === 'deleteAlbum'
        ? { ownerId: userId }
        : { OR: [{ ownerId: userId }, { members: { some: membership } }] };
    const album = await this.prisma.album.findFirst({
      where: {
        AND: [{ shared: true }, albumWhere(userId), target, permission],
      },
      select: { id: true },
    });
    return Boolean(album);
  }
}
