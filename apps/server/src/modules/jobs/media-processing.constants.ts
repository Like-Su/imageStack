import type { Prisma } from '../../prisma/generated/prisma/client';
import { MEDIA_MIME_TYPES } from '../../common/media-formats';

export const MEDIA_QUEUE_NAME = 'media-processing';
export const MEDIA_JOB_NAME = 'asset.ingest';

export const VIDEO_PROCESSING_COMMAND = {
  FFMPEG: 'ffmpeg',
  FFPROBE: 'ffprobe',
} as const;

export type VideoProcessingCommand =
  (typeof VIDEO_PROCESSING_COMMAND)[keyof typeof VIDEO_PROCESSING_COMMAND];

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
  mediaType: { in: ['IMAGE', 'VIDEO'] },
  storageProvider: 'LOCAL_FS',
  storageKey: { not: null },
  mimeType: { in: MEDIA_MIME_TYPES },
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
