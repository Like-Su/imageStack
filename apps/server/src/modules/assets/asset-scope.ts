import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../prisma/generated/prisma/client';

export function assetWhere(
  ownerId: string,
  deleted: boolean | null = false,
): Prisma.FileNodeWhereInput {
  return {
    ownerId,
    ...(deleted === null ? {} : { deleted }),
    type: 'FILE',
    mediaType: 'IMAGE',
    storageProvider: 'LOCAL_FS',
    storageKey: { not: null },
    mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] },
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
