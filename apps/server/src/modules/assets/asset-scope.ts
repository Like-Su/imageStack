import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../prisma/generated/prisma/client';
import { MEDIA_MIME_TYPES } from '../../common/media-formats';
import { albumWhere } from '../collections/album-scope';
import { storageProviderTypes } from '../storage/storage.provider';

export function mediaAssetWhere(
  deleted: boolean | null = false,
): Prisma.FileNodeWhereInput {
  return {
    ...(deleted === null ? {} : { deleted }),
    type: 'FILE',
    mediaType: { in: ['IMAGE', 'VIDEO'] },
    storageProvider: { in: storageProviderTypes },
    storageKey: { not: null },
    mimeType: { in: MEDIA_MIME_TYPES },
  };
}

export function assetWhere(
  ownerId: string,
  deleted: boolean | null = false,
): Prisma.FileNodeWhereInput {
  return { ...mediaAssetWhere(deleted), ownerId };
}

export function readableAssetWhere(userId: string): Prisma.FileNodeWhereInput {
  return {
    ...mediaAssetWhere(),
    OR: [
      { ownerId: userId },
      { albums: { some: { album: { shared: true, ...albumWhere(userId) } } } },
    ],
  };
}

export async function requireOwnedAssets(
  transaction: Prisma.TransactionClient,
  ownerId: string,
  ids: string[],
  deleted: boolean | null = false,
): Promise<void> {
  const count = await transaction.fileNode.count({
    where: { ...assetWhere(ownerId, deleted), id: { in: ids } },
  });

  if (count !== ids.length) {
    throw new NotFoundException('部分资产不存在或不符合操作状态');
  }
}
