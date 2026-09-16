import type { Prisma } from '../../prisma/generated/prisma/client';
import { createHash } from 'node:crypto';

export const thumbnailRevisionSelect = {
  storageProvider: true,
  storageBucket: true,
  thumbnailKey: true,
  processingStatus: true,
} satisfies Prisma.FileNodeSelect;

export function thumbnailRevision(
  asset:
    | {
        thumbnailKey: string | null;
        processingStatus: string | null;
        storageProvider: string | null;
        storageBucket: string | null;
      }
    | null
    | undefined,
) {
  if (!asset) return null;
  return asset.thumbnailKey
    ? createHash('sha256')
        .update(
          JSON.stringify([
            asset.storageProvider,
            asset.storageBucket,
            asset.thumbnailKey,
          ]),
        )
        .digest('hex')
    : (asset.processingStatus ?? 'PENDING');
}

export const assetMediaSelect = {
  storageProvider: true,
  storageBucket: true,
  id: true,
  ownerId: true,
  name: true,
  mediaType: true,
  storageKey: true,
  mimeType: true,
  thumbnailKey: true,
  thumbnailVersion: true,
  previewKey: true,
  hlsKey: true,
  hlsSegmentCount: true,
  processingStatus: true,
  processingError: true,
} satisfies Prisma.FileNodeSelect;

export type MediaAsset = Prisma.FileNodeGetPayload<{
  select: typeof assetMediaSelect;
}>;
