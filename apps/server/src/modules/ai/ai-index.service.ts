import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { IMAGE_MAX_BYTES } from '../../common/media-formats';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { FileNode, Prisma } from '../../prisma/generated/prisma/client';
import { STORAGE_PROVIDER, StorageError } from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';
import {
  AI_INDEX_BATCH_SIZE,
  AI_INDEX_LEASE_MS,
  AI_INDEX_MAX_ATTEMPTS,
  AiRecognitionError,
  aiImageWhere,
  runnableRecognitionWhere,
} from './ai.constants';
import { AiVisionService } from './ai-vision.service';

@Injectable()
export class AiIndexService {
  private readonly logger = new Logger(AiIndexService.name);
  private readonly queueListeners = new Set<() => void>();

  onQueued(listener: () => void) {
    this.queueListeners.add(listener);
    return () => {
      this.queueListeners.delete(listener);
    };
  }

  private notifyQueued() {
    for (const listener of this.queueListeners) listener();
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly vision: AiVisionService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  get enabled() {
    return this.vision.enabled;
  }
  get configurationError() {
    return this.vision.configurationError;
  }

  async detail(assetId: string, userId: string) {
    const asset = await this.prisma.fileNode.findFirst({
      where: {
        id: assetId,
        ownerId: userId,
        type: 'FILE',
        mediaType: 'IMAGE',
        deleted: false,
      },
      select: {
        recognition: {
          select: {
            status: true,
            description: true,
            keywords: true,
            ocrText: true,
            model: true,
            error: true,
            attempts: true,
            indexedAt: true,
            nextAttemptAt: true,
          },
        },
      },
    });
    if (!asset) throw new NotFoundException('图片不存在');
    return asset.recognition;
  }

  async status(userId: string) {
    const where = { ...aiImageWhere, ownerId: userId };
    const [total, groups] = await Promise.all([
      this.prisma.fileNode.count({ where }),
      this.prisma.assetRecognition.groupBy({
        by: ['status'],
        where: { asset: { is: where } },
        _count: { _all: true },
      }),
    ]);
    const counts = { PENDING: 0, PROCESSING: 0, READY: 0, FAILED: 0 };
    for (const group of groups) counts[group.status] = group._count._all;
    return {
      configured: this.enabled,
      configurationError: this.vision.configurationError,
      model: this.vision.model || null,
      autoIndex:
        this.enabled && this.config.get<boolean>('AI_AUTO_INDEX', true),
      total,
      unindexed: Math.max(
        0,
        total - Object.values(counts).reduce((sum, count) => sum + count, 0),
      ),
      counts,
      batchSize: AI_INDEX_BATCH_SIZE,
    };
  }

  async enqueueAutomatic(data: { assetId: string; ownerId: string }) {
    if (!this.enabled || !this.config.get<boolean>('AI_AUTO_INDEX', true))
      return;
    const asset = await this.prisma.fileNode.findFirst({
      where: { ...aiImageWhere, id: data.assetId, ownerId: data.ownerId },
      select: { id: true },
    });
    if (asset) {
      const created = await this.prisma.assetRecognition.createMany({
        data: [{ assetId: asset.id }],
        skipDuplicates: true,
      });
      if (created.count) this.notifyQueued();
    }
  }

  async enqueue(userId: string, ids?: string[]) {
    this.vision.assertConfigured();
    const assets = await this.prisma.fileNode.findMany({
      where: {
        ...aiImageWhere,
        ownerId: userId,
        ...(ids
          ? { id: { in: ids } }
          : {
              OR: [
                { recognition: { is: null } },
                { recognition: { is: { status: 'FAILED' } } },
              ],
            }),
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: AI_INDEX_BATCH_SIZE,
    });
    if (ids && assets.length !== ids.length)
      throw new NotFoundException('部分图片不存在、已删除或尚未完成媒体处理');
    if (!assets.length) return { queued: 0 };
    const assetIds = assets.map((asset) => asset.id);
    const queued = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.assetRecognition.createMany({
        data: assetIds.map((assetId) => ({ assetId })),
        skipDuplicates: true,
      });
      const retried = await transaction.assetRecognition.updateMany({
        where: {
          assetId: { in: assetIds },
          status: 'FAILED',
          asset: { is: { ...aiImageWhere, ownerId: userId } },
        },
        data: {
          status: 'PENDING',
          error: null,
          attempts: 0,
          leaseToken: null,
          leaseUntil: null,
          nextAttemptAt: null,
        },
      });
      return created.count + retried.count;
    });
    if (queued) this.notifyQueued();
    return { queued };
  }

  runnable(limit: number) {
    return this.prisma.assetRecognition.findMany({
      where: {
        ...runnableRecognitionWhere(new Date()),
        asset: { is: aiImageWhere },
      },
      select: { assetId: true, asset: { select: { ownerId: true } } },
      orderBy: [{ createdAt: 'asc' }, { assetId: 'asc' }],
      take: limit,
    });
  }

  async process(assetId: string, ownerId: string, signal: AbortSignal) {
    if (!this.enabled || signal.aborted) return;
    const record = await this.prisma.assetRecognition.findFirst({
      where: { assetId, asset: { is: { ...aiImageWhere, ownerId } } },
      include: { asset: true },
    });
    if (!record) return;
    const claimWhere: Prisma.AssetRecognitionWhereInput = {
      ...runnableRecognitionWhere(new Date()),
      assetId,
      attempts: record.attempts,
      leaseToken: record.leaseToken,
      asset: {
        is: {
          ...aiImageWhere,
          ownerId,
          storageKey: record.asset.storageKey,
          hash: record.asset.hash,
        },
      },
    };
    if (record.attempts >= AI_INDEX_MAX_ATTEMPTS) {
      await this.prisma.assetRecognition.updateMany({
        where: claimWhere,
        data: {
          status: 'FAILED',
          error: '识图重试次数已耗尽，可手动重试',
          leaseToken: null,
          leaseUntil: null,
          nextAttemptAt: null,
        },
      });
      return;
    }
    const leaseToken = randomUUID();
    const attempt = record.attempts + 1;
    const claimed = await this.prisma.assetRecognition.updateMany({
      where: claimWhere,
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        model: this.vision.model,
        error: null,
        leaseToken,
        leaseUntil: new Date(Date.now() + AI_INDEX_LEASE_MS),
        nextAttemptAt: null,
      },
    });
    if (claimed.count !== 1) return;
    const processingWhere: Prisma.AssetRecognitionWhereInput = {
      assetId,
      status: 'PROCESSING',
      leaseToken,
      asset: claimWhere.asset,
    };
    const controller = new AbortController();
    const abort = () => controller.abort(new Error('识图任务已停止'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    let renewal: Promise<void> | undefined;
    const timer = setInterval(() => {
      if (renewal) return;
      renewal = this.prisma.assetRecognition
        .updateMany({
          where: processingWhere,
          data: { leaseUntil: new Date(Date.now() + AI_INDEX_LEASE_MS) },
        })
        .then((result) => {
          if (result.count !== 1) abort();
        })
        .catch(() => abort())
        .finally(() => {
          renewal = undefined;
        });
    }, AI_INDEX_LEASE_MS / 3);
    timer.unref();
    try {
      const bytes = await this.readImage(record.asset, controller.signal);
      const result = await this.vision.recognize(bytes, controller.signal);
      controller.signal.throwIfAborted();
      await this.prisma.assetRecognition.updateMany({
        where: processingWhere,
        data: {
          ...result,
          sourceHash: record.asset.hash,
          status: 'READY',
          indexedAt: new Date(),
          error: null,
          leaseToken: null,
          leaseUntil: null,
          nextAttemptAt: null,
        },
      });
    } catch (error) {
      const failed =
        !signal.aborted &&
        ((error instanceof AiRecognitionError && error.permanent) ||
          attempt >= AI_INDEX_MAX_ATTEMPTS);
      const message =
        error instanceof AiRecognitionError
          ? error.message
          : '识图任务中断或暂时失败，等待重试';
      await this.prisma.assetRecognition.updateMany({
        where: processingWhere,
        data: {
          status: failed ? 'FAILED' : 'PENDING',
          error: message,
          leaseToken: null,
          leaseUntil: null,
          nextAttemptAt: failed
            ? null
            : new Date(Date.now() + 30000 * 2 ** (attempt - 1)),
        },
      });
      if (!signal.aborted) this.logger.warn(`图片 ${assetId}：${message}`);
    } finally {
      clearInterval(timer);
      await renewal;
      signal.removeEventListener('abort', abort);
    }
  }

  private async readImage(asset: FileNode, signal: AbortSignal) {
    signal.throwIfAborted();
    if (
      !asset.storageKey ||
      !asset.size ||
      asset.size > BigInt(IMAGE_MAX_BYTES)
    )
      throw new AiRecognitionError('原图大小或存储信息无效', true);
    const opened = await this.storage
      .read(asset.storageKey)
      .catch((error: unknown) => {
        if (error instanceof StorageError && error.code === 'NOT_FOUND')
          throw new AiRecognitionError('原图文件不存在，无法识别', true);
        throw error;
      });
    const abort = () => {
      opened.stream.destroy(new AiRecognitionError('原图读取中断'));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(
      () => opened.stream.destroy(new AiRecognitionError('原图读取超时')),
      30000,
    );
    timer.unref();
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      if (opened.stat.size !== asset.size)
        throw new AiRecognitionError('原图存储大小不一致', true);
      for await (const chunk of opened.stream) {
        size += chunk.length;
        if (size > Number(asset.size))
          throw new AiRecognitionError('原图数据超过声明大小', true);
        chunks.push(Buffer.from(chunk));
      }
      if (size !== Number(asset.size))
        throw new AiRecognitionError('原图数据不完整', true);
      return Buffer.concat(chunks, size);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      opened.stream.destroy();
    }
  }
}
