import type { Prisma } from '../../prisma/generated/prisma/client';

export const AI_INDEX_BATCH_SIZE = 100;
export const AI_INDEX_INTERVAL_MS = 5000;
export const AI_INDEX_LEASE_MS = 180000;
export const AI_INDEX_MAX_ATTEMPTS = 3;
export const AI_IMAGE_MAX_EDGE = 1536;
export const AI_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const aiImageWhere = {
  type: 'FILE',
  mediaType: 'IMAGE',
  deleted: false,
  storageProvider: 'LOCAL_FS',
  storageKey: { not: null },
  processingStatus: 'READY',
} satisfies Prisma.FileNodeWhereInput;

export function runnableRecognitionWhere(
  now: Date,
): Prisma.AssetRecognitionWhereInput {
  return {
    AND: [
      { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      {
        OR: [
          { status: 'PENDING' },
          {
            status: 'PROCESSING',
            OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
          },
        ],
      },
    ],
  };
}

export class AiRecognitionError extends Error {
  constructor(
    message: string,
    public readonly permanent = false,
  ) {
    super(message);
    this.name = 'AiRecognitionError';
  }
}
