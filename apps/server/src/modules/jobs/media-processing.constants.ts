import type { Prisma } from '../../prisma/generated/prisma/client';

export const MEDIA_QUEUE_NAME = 'media-processing';
export const MEDIA_JOB_NAME = 'asset.ingest';

export interface MediaJobData {
  assetId: string;
  ownerId: string;
}

export type MediaProcessingResult =
  | { kind: 'complete' | 'skip' }
  | { kind: 'retry'; attempt: number; delayMs: number; error: string }
  | { kind: 'failed'; attempt: number; error: string };

export const mediaAssetWhere = {
  type: 'FILE',
  mediaType: 'IMAGE',
  storageProvider: 'LOCAL_FS',
  storageKey: { not: null },
  mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] },
} satisfies Prisma.FileNodeWhereInput;

export function runnableMediaWhere(now: Date): Prisma.FileNodeWhereInput {
  return {
    AND: [
      {
        OR: [
          { processingNextAttemptAt: null },
          { processingNextAttemptAt: { lte: now } },
        ],
      },
      {
        OR: [
          { processingStatus: null },
          { processingStatus: 'PENDING' },
          {
            processingStatus: 'PROCESSING',
            OR: [
              { processingLeaseUntil: null },
              { processingLeaseUntil: { lte: now } },
            ],
          },
        ],
      },
    ],
  };
}

export function mediaRetryDelay(backoffMs: number, attempt: number): number {
  return backoffMs * 2 ** Math.max(0, attempt - 1);
}

export class MediaProcessingError extends Error {
  constructor(
    message: string,
    public readonly permanent = false,
  ) {
    super(message);
    this.name = 'MediaProcessingError';
  }
}
