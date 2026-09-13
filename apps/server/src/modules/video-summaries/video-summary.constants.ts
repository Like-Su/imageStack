import type { Prisma } from '../../prisma/generated/prisma/client';

export const VIDEO_SUMMARY_INTERVAL_MS = 5000;
export const VIDEO_SUMMARY_LEASE_MS = 180000;
export const VIDEO_SUMMARY_MAX_ATTEMPTS = 3;
export const VIDEO_AUDIO_CHUNK_SECONDS = 300;
export const VIDEO_TRANSCRIPT_MAX_CHARS = 1000000;
export const VIDEO_TRANSCRIPT_MAX_SEGMENTS = 50000;
export const VIDEO_ASR_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
export const VIDEO_SUMMARY_CHUNK_CHARS = 6000;
export const VIDEO_SUMMARY_EVENT_LOCK = 190071;

export const summaryVideoWhere = {
  type: 'FILE',
  mediaType: 'VIDEO',
  deleted: false,
  storageProvider: 'LOCAL_FS',
  storageKey: { not: null },
} satisfies Prisma.FileNodeWhereInput;

export function runnableVideoSummaryWhere(
  now: Date,
): Prisma.VideoSummaryWhereInput {
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

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface VideoTranscript {
  transcript: string;
  segments: TranscriptSegment[];
  language: string | null;
  transcribedChunks: number;
}

export class VideoSummaryError extends Error {
  constructor(
    message: string,
    public readonly permanent = false,
  ) {
    super(message);
    this.name = 'VideoSummaryError';
  }
}
