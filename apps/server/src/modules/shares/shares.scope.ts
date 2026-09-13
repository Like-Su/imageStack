import { NotFoundException } from '@nestjs/common';
import type { Prisma, ShareLink } from '../../prisma/generated/prisma/client';
import { PermissionCode, RoleCode } from '../../common/constants';
import { assetWhere } from '../assets/asset-scope';

export const MAX_SHARED_IMAGES = 500;

export function shareUnavailable(): never {
  throw new NotFoundException({
    code: 'SHARE_UNAVAILABLE',
    message: '分享已失效或内容不可用',
  });
}

export function shareOwnerWhere(): Prisma.UserWhereInput {
  return {
    deleted: false,
    status: 'ACTIVE',
    role: { status: 1 },
    OR: [
      { role: { roleCode: RoleCode.ADMIN } },
      {
        role: {
          permissions: {
            some: {
              permission: { permissionCode: PermissionCode.ASSET_SHARE },
            },
          },
        },
      },
      {
        permissions: {
          some: { permission: { permissionCode: PermissionCode.ASSET_SHARE } },
        },
      },
    ],
  };
}

export function sharedImagesWhere(
  share: Pick<ShareLink, 'ownerId' | 'assetId' | 'albumId'>,
): Prisma.FileNodeWhereInput {
  return {
    ...assetWhere(share.ownerId),
    mediaType: 'IMAGE',
    ...(share.assetId
      ? { id: share.assetId }
      : { albums: { some: { albumId: share.albumId } } }),
  };
}
