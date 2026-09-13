import type { Prisma } from '../../prisma/generated/prisma/client';

export const assetMediaSelect = {
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
