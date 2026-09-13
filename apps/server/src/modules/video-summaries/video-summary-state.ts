import type { Prisma } from '../../prisma/generated/prisma/client';
import { VIDEO_SUMMARY_EVENT_LOCK } from './video-summary.constants';

export const VIDEO_SUMMARY_NOTIFY_CHANNEL = 'image_stack_video_summaries';

export const videoSummaryStateSelect = {
  status: true,
  stage: true,
  transcribedChunks: true,
  language: true,
  summary: true,
  model: true,
  error: true,
  attempts: true,
  nextAttemptAt: true,
  completedAt: true,
  updatedAt: true,
} satisfies Prisma.VideoSummarySelect;

type SummaryState = Prisma.VideoSummaryGetPayload<{
  select: typeof videoSummaryStateSelect;
}>;

export function serializeVideoSummaryState(record: SummaryState) {
  return {
    status: record.status,
    stage: record.stage,
    transcribedChunks: record.transcribedChunks,
    language: record.language?.slice(0, 128) ?? null,
    summary: record.summary?.slice(0, 8000) ?? null,
    model: record.model?.slice(0, 256) ?? null,
    error: record.error?.slice(0, 1024) ?? null,
    attempts: record.attempts,
    nextAttemptAt: record.nextAttemptAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function recordVideoSummaryEvent(
  transaction: Prisma.TransactionClient,
  assetId: string,
  ownerId: string,
  status: SummaryState['status'],
) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${VIDEO_SUMMARY_EVENT_LOCK}::integer, hashtext(${ownerId}::text))`;
  await transaction.videoSummaryEvent.create({ data: { assetId, status } });
  await transaction.$executeRaw`SELECT pg_notify(${VIDEO_SUMMARY_NOTIFY_CHANNEL}, ${JSON.stringify({ ownerId })})`;
}
