import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { Metadata, Sharp } from 'sharp';
import { PrismaService } from '../../common/prisma/prisma.service';
import { sharp } from '../../common/sharp';
import type { FileNode, Prisma } from '../../prisma/generated/prisma/client';
import {
  createStorageKey,
  STORAGE_PROVIDER,
  StorageError,
} from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_PIXELS,
} from '../uploads/upload.constants';
import { extractExif } from './exif-metadata';
import {
  mediaAssetWhere,
  MediaProcessingError,
  mediaRetryDelay,
  runnableMediaWhere,
} from './media-processing.constants';
import type {
  MediaJobData,
  MediaProcessingResult,
} from './media-processing.constants';

@Injectable()
export class MediaProcessorService {
  private readonly logger = new Logger(MediaProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  async process(data: MediaJobData): Promise<MediaProcessingResult> {
    const asset = await this.prisma.fileNode.findFirst({
      where: {
        ...mediaAssetWhere,
        id: data.assetId,
        ownerId: data.ownerId,
      },
    });

    if (!asset || asset.processingStatus === 'READY') return { kind: 'skip' };
    if (asset.processingStatus === 'FAILED') {
      return {
        kind: 'failed',
        attempt: asset.processingAttempts,
        error: asset.processingError ?? '媒体处理失败',
      };
    }

    const now = new Date();
    const identity = {
      id: asset.id,
      ownerId: asset.ownerId,
      storageKey: asset.storageKey,
      thumbnailKey: asset.thumbnailKey,
    };
    const claimWhere = {
      ...mediaAssetWhere,
      ...runnableMediaWhere(now),
      ...identity,
      processingAttempts: asset.processingAttempts,
      processingToken: asset.processingToken,
    };
    const maxAttempts = this.config.get<number>('MEDIA_PROCESSING_ATTEMPTS', 3);

    if (asset.processingAttempts >= maxAttempts) {
      const error = '媒体任务重试已耗尽或执行中断';
      const updated = await this.prisma.fileNode.updateMany({
        where: claimWhere,
        data: {
          processingStatus: 'FAILED',
          processingError: error,
          processingToken: null,
          processingLeaseUntil: null,
          processingNextAttemptAt: null,
        },
      });
      return updated.count === 1
        ? { kind: 'failed', attempt: asset.processingAttempts, error }
        : { kind: 'skip' };
    }

    const leaseMs = this.config.get<number>(
      'MEDIA_PROCESSING_LEASE_MS',
      120000,
    );
    const processingToken = randomUUID();
    const attempt = asset.processingAttempts + 1;
    const claimed = await this.prisma.fileNode.updateMany({
      where: claimWhere,
      data: {
        processingStatus: 'PROCESSING',
        processingError: null,
        processingAttempts: { increment: 1 },
        processingToken,
        processingLeaseUntil: new Date(now.getTime() + leaseMs),
        processingNextAttemptAt: null,
      },
    });

    if (claimed.count !== 1) return { kind: 'skip' };

    const processingWhere = {
      ...mediaAssetWhere,
      ...identity,
      processingToken,
      processingStatus: 'PROCESSING',
    } satisfies Prisma.FileNodeWhereInput;
    const stopHeartbeat = this.maintainLease(processingWhere, leaseMs);

    let candidateKey: string | null = null;
    let linkAttempted = false;

    try {
      const bytes = await this.readOriginal(asset);
      const prepared = await this.prepare(asset, bytes);
      let thumbnailKey = asset.thumbnailKey;

      if (prepared.thumbnail) {
        const key = createStorageKey('derived');
        const stored = await this.storage.put(
          key,
          Readable.from([prepared.thumbnail]),
        );
        candidateKey = key;

        if (
          stored.key !== key ||
          stored.size !== BigInt(prepared.thumbnail.length)
        ) {
          throw new MediaProcessingError('缩略图写入结果不完整');
        }

        thumbnailKey = key;
      }

      linkAttempted = true;
      const updated = await this.prisma.fileNode.updateMany({
        where: processingWhere,
        data: {
          thumbnailKey,
          width: prepared.width,
          height: prepared.height,
          exif: prepared.exif,
          takenAt: prepared.takenAt,
          processingStatus: 'READY',
          processingError: null,
          processingToken: null,
          processingLeaseUntil: null,
          processingNextAttemptAt: null,
        },
      });

      if (updated.count !== 1 && candidateKey) {
        await this.discard(candidateKey);
      }
      return { kind: updated.count === 1 ? 'complete' : 'skip' };
    } catch (error) {
      if (candidateKey && !linkAttempted) {
        await this.discard(candidateKey);
      } else if (candidateKey) {
        this.logger.warn(`媒体关联结果未确认，保留候选缩略图：${asset.id}`);
      }

      const permanent =
        error instanceof MediaProcessingError && error.permanent;
      const message =
        error instanceof MediaProcessingError
          ? error.message
          : '媒体处理暂时失败';
      const failed = permanent || attempt >= maxAttempts;
      const delayMs = mediaRetryDelay(
        this.config.get<number>('MEDIA_PROCESSING_BACKOFF_MS', 1000),
        attempt,
      );

      this.logger.error(
        `媒体处理失败：${asset.id}`,
        error instanceof Error ? error.stack : String(error),
      );

      const updated = await this.prisma.fileNode.updateMany({
        where: processingWhere,
        data: {
          processingStatus: failed ? 'FAILED' : 'PENDING',
          processingError: message,
          processingToken: null,
          processingLeaseUntil: null,
          processingNextAttemptAt: failed
            ? null
            : new Date(Date.now() + delayMs),
        },
      });

      if (updated.count !== 1) return { kind: 'skip' };
      return failed
        ? { kind: 'failed', attempt, error: message }
        : { kind: 'retry', attempt, delayMs, error: message };
    } finally {
      await stopHeartbeat();
    }
  }

  private maintainLease(where: Prisma.FileNodeWhereInput, leaseMs: number) {
    let renewal: Promise<void> | undefined;
    const timer = setInterval(
      () => {
        if (renewal) return;

        renewal = this.prisma.fileNode
          .updateMany({
            where,
            data: { processingLeaseUntil: new Date(Date.now() + leaseMs) },
          })
          .then((result) => {
            if (result.count !== 1) clearInterval(timer);
          })
          .catch((error: unknown) => {
            this.logger.warn(
              `媒体处理租约续期暂缓：${error instanceof Error ? error.message : String(error)}`,
            );
          })
          .finally(() => {
            renewal = undefined;
          });
      },
      Math.floor(leaseMs / 3),
    );
    timer.unref();

    return async () => {
      clearInterval(timer);
      await renewal;
    };
  }

  private async readOriginal(asset: FileNode): Promise<Buffer> {
    if (
      !asset.storageKey ||
      asset.size === null ||
      asset.size <= 0n ||
      asset.size > BigInt(UPLOAD_MAX_BYTES)
    ) {
      throw new MediaProcessingError('原图大小或存储信息无效', true);
    }

    const source = await this.storage
      .read(asset.storageKey)
      .catch((error: unknown) => {
        if (error instanceof StorageError && error.code === 'NOT_FOUND') {
          throw new MediaProcessingError('原图对象不存在', true);
        }
        throw error;
      });
    const chunks: Buffer[] = [];
    let receivedBytes = 0;
    const timeout = setTimeout(
      () => {
        source.stream.destroy(new MediaProcessingError('原图读取超时'));
      },
      this.config.get<number>('MEDIA_PROCESSING_READ_TIMEOUT_MS', 30000),
    );

    try {
      if (source.stat.size !== asset.size) {
        throw new MediaProcessingError('原图大小与数据库记录不一致', true);
      }

      for await (const chunk of source.stream) {
        if (!Buffer.isBuffer(chunk)) {
          throw new MediaProcessingError('原图读取格式无效', true);
        }

        receivedBytes += chunk.length;
        if (
          receivedBytes > UPLOAD_MAX_BYTES ||
          BigInt(receivedBytes) > asset.size
        ) {
          throw new MediaProcessingError('原图超过处理大小限制', true);
        }
        chunks.push(chunk);
      }

      if (BigInt(receivedBytes) !== asset.size) {
        throw new MediaProcessingError('原图读取不完整');
      }

      return Buffer.concat(chunks, receivedBytes);
    } finally {
      clearTimeout(timeout);
      source.stream.destroy();
    }
  }

  private async prepare(asset: FileNode, bytes: Buffer) {
    let decoder: Sharp;
    let metadata: Metadata;

    try {
      decoder = sharp(bytes, {
        failOn: 'warning',
        limitInputPixels: UPLOAD_MAX_PIXELS,
        animated: true,
      }).timeout({ seconds: 10 });
      metadata = await decoder.metadata();
    } catch {
      throw new MediaProcessingError('图片损坏、解码超时或超过像素限制', true);
    }

    const mimeTypes: Record<string, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };

    if (
      mimeTypes[metadata.format] !== asset.mimeType ||
      (metadata.pages ?? 1) !== 1 ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > UPLOAD_MAX_PIXELS
    ) {
      throw new MediaProcessingError(
        '图片格式、帧数或尺寸不符合处理要求',
        true,
      );
    }

    const extracted = await extractExif(
      metadata.exif,
      this.config.get<string>('MEDIA_EXIF_DEFAULT_OFFSET', '+00:00'),
    );
    let thumbnail: Buffer | null = null;

    if (
      !asset.thumbnailKey ||
      !(await this.storage.exists(asset.thumbnailKey))
    ) {
      try {
        thumbnail = await decoder
          .rotate()
          .resize({
            width: 256,
            height: 256,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toBuffer();
      } catch {
        throw new MediaProcessingError('无法生成缩略图', true);
      }
    }

    const rotated =
      (metadata.orientation ?? 1) >= 5 && (metadata.orientation ?? 1) <= 8;

    return {
      ...extracted,
      width: rotated ? metadata.height : metadata.width,
      height: rotated ? metadata.width : metadata.height,
      thumbnail,
    };
  }

  private async discard(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn(
        `候选缩略图清理失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
