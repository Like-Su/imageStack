import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleCode } from '../../common/constants';
import type { Prisma } from '../../prisma/generated/prisma/client';

export function albumWhere(userId: string): Prisma.AlbumWhereInput {
  return {
    OR: [
      { ownerId: userId },
      {
        shared: true,
        owner: { deleted: false, status: 'ACTIVE', role: { status: 1 } },
        members: { some: { userId } },
      },
    ],
  };
}

export function albumAccessInclude(userId: string) {
  return {
    owner: {
      select: {
        id: true,
        username: true,
        role: { select: { roleCode: true } },
      },
    },
    members: {
      where: { userId },
      select: { userId: true, canAdd: true, canEdit: true, canRemove: true },
    },
  } satisfies Prisma.AlbumInclude;
}

type AlbumAccessRow = Prisma.AlbumGetPayload<{
  include: ReturnType<typeof albumAccessInclude>;
}>;

export function albumPermissions(album: AlbumAccessRow, userId: string) {
  const owner = album.ownerId === userId;
  const member = album.shared ? album.members[0] : undefined;
  return {
    view: owner || Boolean(member),
    addAssets: owner || Boolean(member?.canAdd),
    edit: owner || Boolean(member?.canEdit),
    removeAssets: owner || Boolean(member?.canRemove),
    deleteAlbum: owner,
    manageMembers:
      album.shared && owner && album.owner.role.roleCode === RoleCode.ADMIN,
  };
}

export async function requireAlbumAccess(
  transaction: Prisma.TransactionClient,
  albumId: string,
  userId: string,
  permission: keyof ReturnType<typeof albumPermissions>,
) {
  const album = await transaction.album.findFirst({
    where: { id: albumId, ...albumWhere(userId) },
    include: albumAccessInclude(userId),
  });
  if (!album) throw new NotFoundException('相册不存在或未获邀请');
  if (!albumPermissions(album, userId)[permission])
    throw new ForbiddenException('没有此相册的操作权限');
  return album;
}
