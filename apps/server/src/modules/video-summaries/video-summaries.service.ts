import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { FileNode, Prisma } from '../../prisma/generated/prisma/client';
import { MediaProcessingError } from '../jobs/media-processing.constants';
import { VideoSummaryLlmService } from './video-summary-llm.service';
import { VideoTranscriptionService } from './video-transcription.service';
import {
  VIDEO_SUMMARY_EVENT_LOCK,
  VIDEO_SUMMARY_LEASE_MS,
  VIDEO_SUMMARY_MAX_ATTEMPTS,
  VideoSummaryError,
  runnableVideoSummaryWhere,
  summaryVideoWhere,
} from './video-summary.constants';
import type {
  TranscriptSegment,
  VideoTranscript,
} from './video-summary.constants';

function transcriptData(result: VideoTranscript) {
  return {
    ...result,
    segments: result.segments.map((segment) => ({ ...segment })),
  };
}

@Injectable()
export class VideoSummariesService {
  private readonly logger = new Logger(VideoSummariesService.name);
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly transcription: VideoTranscriptionService,
    private readonly llm: VideoSummaryLlmService,
  ) {}

  get autoSummarize() {
    return this.config.get<boolean>('VIDEO_SUMMARY_AUTO', true);
  }

  get enabled() {
    return !this.llm.configurationError;
  }

  get configurationError() {
    return this.llm.configurationError;
  }

  onQueued(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private wake() {
    for (const listener of this.listeners) listener();
  }

  async detail(assetId: string, ownerId: string) {
    const asset = await this.prisma.fileNode.findFirst({
      where: {
        id: assetId,
        ownerId,
        type: 'FILE',
        mediaType: 'VIDEO',
        deleted: false,
      },
      select: {
        videoSummary: {
          select: {
            status: true,
            stage: true,
            transcript: true,
            segments: true,
            transcribedChunks: true,
            language: true,
            summary: true,
            model: true,
            error: true,
            attempts: true,
            nextAttemptAt: true,
            completedAt: true,
          },
        },
      },
    });
    if (!asset) throw new NotFoundException('视频不存在');
    return {
      configured: this.enabled,
      configurationError: this.configurationError,
      autoSummarize: this.autoSummarize,
      result: asset.videoSummary,
    };
  }

  async enqueueAutomatic(file: Pick<FileNode, 'id' | 'ownerId' | 'mediaType'>) {
    if (!this.autoSummarize || file.mediaType !== 'VIDEO') return;
    const asset = await this.prisma.fileNode.findFirst({
      where: { ...summaryVideoWhere, id: file.id, ownerId: file.ownerId },
      select: { id: true, hash: true },
    });
    if (!asset) return;
    await this.prisma.videoSummary.createMany({
      data: [{ assetId: asset.id, sourceHash: asset.hash }],
      skipDuplicates: true,
    });
    this.wake();
  }

  async enqueue(assetId: string, ownerId: string) {
    this.llm.assertConfigured();
    const asset = await this.prisma.fileNode.findFirst({
      where: { ...summaryVideoWhere, id: assetId, ownerId },
      select: { id: true, hash: true },
    });
    if (!asset) throw new NotFoundException('视频不存在或已删除');
    const queued = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.videoSummary.createMany({
        data: [{ assetId, sourceHash: asset.hash }],
        skipDuplicates: true,
      });
      const retried = await transaction.videoSummary.updateMany({
        where: {
          assetId,
          status: 'FAILED',
          asset: { is: { ...summaryVideoWhere, ownerId } },
        },
        data: {
          status: 'PENDING',
          attempts: 0,
          error: null,
          completedAt: null,
          leaseToken: null,
          leaseUntil: null,
          nextAttemptAt: null,
        },
      });
      return created.count + retried.count;
    });
    if (queued) this.wake();
    return { queued };
  }

  runnable(limit: number) {
    return this.prisma.videoSummary.findMany({
      where: {
        ...runnableVideoSummaryWhere(new Date()),
        asset: { is: summaryVideoWhere },
      },
      select: { assetId: true, asset: { select: { ownerId: true } } },
      orderBy: [{ createdAt: 'asc' }, { assetId: 'asc' }],
      take: limit,
    });
  }

  async process(assetId: string, ownerId: string, signal: AbortSignal) {
    if (!this.enabled || signal.aborted) return;
    const record = await this.prisma.videoSummary.findFirst({
      where: { assetId, asset: { is: { ...summaryVideoWhere, ownerId } } },
      include: { asset: true },
    });
    if (!record) return;
    const claimWhere: Prisma.VideoSummaryWhereInput = {
      ...runnableVideoSummaryWhere(new Date()),
      assetId,
      attempts: record.attempts,
      leaseToken: record.leaseToken,
      asset: {
        is: {
          ...summaryVideoWhere,
          ownerId,
          storageKey: record.asset.storageKey,
          hash: record.asset.hash,
        },
      },
    };
    if (record.attempts >= VIDEO_SUMMARY_MAX_ATTEMPTS) {
      await this.finish(claimWhere, assetId, 'FAILED', {
        error: '视频总结重试次数已耗尽，可在视频详情中手动重试',
      });
      return;
    }
    const leaseToken = randomUUID();
    const attempt = record.attempts + 1;
    const resume = record.sourceHash === record.asset.hash;
    const claimed = await this.prisma.videoSummary.updateMany({
      where: claimWhere,
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        leaseToken,
        leaseUntil: new Date(Date.now() + VIDEO_SUMMARY_LEASE_MS),
        nextAttemptAt: null,
        error: null,
        sourceHash: record.asset.hash,
        model: this.llm.model,
        ...(!resume
          ? {
              stage: 'TRANSCRIBING',
              transcript: null,
              segments: [],
              transcribedChunks: 0,
              language: null,
              summary: null,
            }
          : {}),
      },
    });
    if (claimed.count !== 1) return;
    const processingWhere: Prisma.VideoSummaryWhereInput = {
      assetId,
      status: 'PROCESSING',
      leaseToken,
      asset: claimWhere.asset,
    };
    const controller = new AbortController();
    const abort = () =>
      controller.abort(new VideoSummaryError('视频总结任务已停止'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    let renewal: Promise<void> | undefined;
    const timer = setInterval(() => {
      if (renewal) return;
      renewal = this.prisma.videoSummary
        .updateMany({
          where: processingWhere,
          data: { leaseUntil: new Date(Date.now() + VIDEO_SUMMARY_LEASE_MS) },
        })
        .then((result) => {
          if (result.count !== 1) abort();
        })
        .catch(abort)
        .finally(() => {
          renewal = undefined;
        });
    }, VIDEO_SUMMARY_LEASE_MS / 3);
    timer.unref();
    try {
      let transcript: VideoTranscript = {
        transcript: resume ? (record.transcript ?? '') : '',
        segments:
          resume && Array.isArray(record.segments)
            ? (record.segments as unknown as TranscriptSegment[])
            : [],
        language: resume ? record.language : null,
        transcribedChunks: resume ? record.transcribedChunks : 0,
      };
      if (
        !resume ||
        record.stage !== 'SUMMARIZING' ||
        record.transcript === null
      ) {
        transcript = await this.transcription.transcribe(
          record.asset,
          transcript,
          async (progress) => {
            controller.signal.throwIfAborted();
            const updated = await this.prisma.videoSummary.updateMany({
              where: processingWhere,
              data: transcriptData(progress),
            });
            if (updated.count !== 1) {
              abort();
              controller.signal.throwIfAborted();
            }
          },
          controller.signal,
        );
        controller.signal.throwIfAborted();
        const updated = await this.prisma.videoSummary.updateMany({
          where: processingWhere,
          data: { ...transcriptData(transcript), stage: 'SUMMARIZING' },
        });
        if (updated.count !== 1) {
          abort();
          controller.signal.throwIfAborted();
        }
      }
      const summary = await this.llm.summarize(
        transcript.transcript,
        controller.signal,
      );
      controller.signal.throwIfAborted();
      await this.finish(processingWhere, assetId, 'READY', {
        summary,
        completedAt: new Date(),
        error: null,
        model: transcript.transcript ? this.llm.model : null,
      });
    } catch (error) {
      const known =
        error instanceof VideoSummaryError ||
        error instanceof MediaProcessingError;
      const failed =
        !signal.aborted &&
        ((known && error.permanent) || attempt >= VIDEO_SUMMARY_MAX_ATTEMPTS);
      const message = known
        ? error.message
        : '视频转写或总结暂时失败，等待后台重试';
      if (failed)
        await this.finish(processingWhere, assetId, 'FAILED', {
          error: message,
        });
      else
        await this.prisma.videoSummary.updateMany({
          where: processingWhere,
          data: {
            status: 'PENDING',
            error: message,
            leaseToken: null,
            leaseUntil: null,
            nextAttemptAt: new Date(Date.now() + 30000 * 2 ** (attempt - 1)),
            ...(signal.aborted ? { attempts: { decrement: 1 } } : {}),
          },
        });
      if (!signal.aborted) this.logger.warn(`视频 ${assetId}：${message}`);
    } finally {
      clearInterval(timer);
      await renewal;
      signal.removeEventListener('abort', abort);
    }
  }

  private finish(
    where: Prisma.VideoSummaryWhereInput,
    assetId: string,
    status: 'READY' | 'FAILED',
    data: Prisma.VideoSummaryUpdateManyMutationInput,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.videoSummary.updateMany({
        where,
        data: {
          ...data,
          status,
          leaseToken: null,
          leaseUntil: null,
          nextAttemptAt: null,
        },
      });
      if (result.count === 1) {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${VIDEO_SUMMARY_EVENT_LOCK}::integer, 0)`;
        await transaction.videoSummaryEvent.create({
          data: { assetId, status },
        });
      }
      return result.count;
    });
  }
}
