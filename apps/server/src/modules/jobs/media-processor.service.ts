import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { PrismaService } from '../../common/prisma/prisma.service';
import { inspectImageContent } from '../../common/image-inspection';
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from '../../common/media-formats';
import type { VideoFormat } from '../../common/media-formats';
import {
  hlsObjectKeys,
  hlsSegmentKey,
  hlsSegmentName,
} from '../../common/video-stream';
import type { FileNode, Prisma } from '../../prisma/generated/prisma/client';
import {
  createStorageKey,
  STORAGE_PROVIDER,
  StorageError,
} from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';
import { extractExif } from './exif-metadata';
import { VideoProcessorService } from './video-processor.service';
import type { PreparedHls } from './video-processor.service';
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

interface PreparedMedia {
  width: number;
  height: number;
  durationMs: bigint | null;
  exif: Prisma.InputJsonValue;
  takenAt: Date | null;
  thumbnail: Buffer | null;
  previewPath: string | null;
  hls: PreparedHls | null;
}

@Injectable()
export class MediaProcessorService {
  private readonly logger = new Logger(MediaProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly videos: VideoProcessorService,
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
      previewKey: asset.previewKey,
      hlsKey: asset.hlsKey,
      hlsSegmentCount: asset.hlsSegmentCount,
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

    const candidateKeys: string[] = [];
    let temporaryDirectory: string | undefined;
    let linkAttempted = false;

    try {
      let prepared: PreparedMedia;
      if (asset.mediaType === 'VIDEO') {
        temporaryDirectory = await mkdtemp(
          join(tmpdir(), 'image-stack-video-'),
        );
        prepared = await this.prepareVideo(asset, temporaryDirectory);
      } else {
        prepared = await this.prepare(asset, await this.readOriginal(asset));
      }
      let thumbnailKey = asset.thumbnailKey;
      let previewKey = asset.previewKey;
      let hlsKey = asset.hlsKey;
      let hlsSegmentCount = asset.hlsSegmentCount;

      if (prepared.thumbnail) {
        const key = createStorageKey('derived');
        const stored = await this.storage.put(
          key,
          Readable.from([prepared.thumbnail]),
        );
        candidateKeys.push(key);

        if (
          stored.key !== key ||
          stored.size !== BigInt(prepared.thumbnail.length)
        ) {
          throw new MediaProcessingError('缩略图写入结果不完整');
        }

        thumbnailKey = key;
      }

      if (prepared.previewPath) {
        const key = createStorageKey('derived');
        const metadata = await stat(prepared.previewPath);
        const stored = await this.storage.put(
          key,
          createReadStream(prepared.previewPath),
        );
        candidateKeys.push(key);
        if (stored.key !== key || stored.size !== BigInt(metadata.size))
          throw new MediaProcessingError('视频预览写入结果不完整');
        previewKey = key;
      }

      if (prepared.hls) {
        const key = createStorageKey('derived');
        for (let index = 0; index < prepared.hls.segmentCount; index += 1) {
          const segmentKey = hlsSegmentKey(key, index);
          const segmentPath = join(
            prepared.hls.directory,
            hlsSegmentName(index),
          );
          const metadata = await stat(segmentPath);
          const stored = await this.storage.put(
            segmentKey,
            createReadStream(segmentPath),
          );
          candidateKeys.push(segmentKey);
          if (metadata.size < 1 || stored.size !== BigInt(metadata.size))
            throw new MediaProcessingError('HLS 视频分段写入不完整');
        }
        const metadata = await stat(prepared.hls.playlistPath);
        const stored = await this.storage.put(
          key,
          createReadStream(prepared.hls.playlistPath),
        );
        candidateKeys.push(key);
        if (stored.size !== BigInt(metadata.size))
          throw new MediaProcessingError('HLS 播放列表写入不完整');
        hlsKey = key;
        hlsSegmentCount = prepared.hls.segmentCount;
      }

      linkAttempted = true;
      const updated = await this.prisma.fileNode.updateMany({
        where: processingWhere,
        data: {
          thumbnailKey,
          previewKey,
          hlsKey,
          hlsSegmentCount,
          width: prepared.width,
          height: prepared.height,
          durationMs: prepared.durationMs,
          exif: prepared.exif,
          takenAt: prepared.takenAt,
          processingStatus: 'READY',
          processingError: null,
          processingToken: null,
          processingLeaseUntil: null,
          processingNextAttemptAt: null,
        },
      });

      if (updated.count !== 1) {
        await this.discardAll(candidateKeys);
      } else {
        await this.discardReplaced(asset, thumbnailKey, previewKey, hlsKey);
      }
      return { kind: updated.count === 1 ? 'complete' : 'skip' };
    } catch (error) {
      if (!linkAttempted) {
        await this.discardAll(candidateKeys);
      } else if (candidateKeys.length) {
        this.logger.warn(`媒体关联结果未确认，保留候选派生文件：${asset.id}`);
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
      if (temporaryDirectory) {
        await rm(temporaryDirectory, { recursive: true, force: true }).catch(
          (error: unknown) => {
            this.logger.warn(
              `视频临时文件清理失败：${error instanceof Error ? error.message : String(error)}`,
            );
          },
        );
      }
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
      asset.size > BigInt(IMAGE_MAX_BYTES)
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
          receivedBytes > IMAGE_MAX_BYTES ||
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

  private async prepare(
    asset: FileNode,
    bytes: Buffer,
  ): Promise<PreparedMedia> {
    let image: Awaited<ReturnType<typeof inspectImageContent>>;
    try {
      image = await inspectImageContent(bytes);
    } catch (error) {
      throw new MediaProcessingError(
        error instanceof Error ? error.message : '图片损坏或超过处理限制',
        true,
      );
    }
    if (
      image.mimeType !== asset.mimeType &&
      !(image.mimeType === 'image/apng' && asset.mimeType === 'image/png')
    )
      throw new MediaProcessingError('图片格式与资产记录不一致', true);

    const extracted = await extractExif(
      image.metadata.exif,
      this.config.get<string>('MEDIA_EXIF_DEFAULT_OFFSET', '+00:00'),
    );
    let thumbnail: Buffer | null = null;

    if (
      !asset.thumbnailKey ||
      !(await this.storage.exists(asset.thumbnailKey))
    ) {
      try {
        thumbnail = await image.decoder
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

    return {
      ...extracted,
      width: image.width,
      height: image.height,
      durationMs: null,
      thumbnail,
      previewPath: null,
      hls: null,
    };
  }

  private async prepareVideo(
    asset: FileNode,
    directory: string,
  ): Promise<PreparedMedia> {
    if (
      !asset.storageKey ||
      asset.size === null ||
      asset.size <= 0n ||
      asset.size > BigInt(VIDEO_MAX_BYTES)
    )
      throw new MediaProcessingError('视频大小或存储信息无效', true);
    const formats: Record<string, VideoFormat> = {
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-matroska': 'mkv',
    };
    const format = formats[asset.mimeType ?? ''];
    if (!format) throw new MediaProcessingError('视频格式不受支持', true);
    const source = await this.storage
      .read(asset.storageKey)
      .catch((error: unknown) => {
        if (error instanceof StorageError && error.code === 'NOT_FOUND')
          throw new MediaProcessingError('原视频对象不存在', true);
        throw error;
      });
    const timeout = setTimeout(
      () => {
        source.stream.destroy(new MediaProcessingError('原视频读取超时'));
      },
      this.config.get<number>('MEDIA_PROCESSING_READ_TIMEOUT_MS', 30000),
    );
    const path = join(directory, 'source');
    try {
      if (source.stat.size !== asset.size)
        throw new MediaProcessingError('视频大小与数据库记录不一致', true);
      async function* content() {
        let received = 0n;
        for await (const chunk of source.stream) {
          if (!Buffer.isBuffer(chunk))
            throw new MediaProcessingError('视频读取格式无效', true);
          received += BigInt(chunk.length);
          if (received > asset.size || received > BigInt(VIDEO_MAX_BYTES))
            throw new MediaProcessingError('视频超过处理大小限制', true);
          yield chunk;
        }
        if (received !== asset.size)
          throw new MediaProcessingError('原视频读取不完整');
      }
      await pipeline(
        Readable.from(content()),
        createWriteStream(path, { flags: 'wx', mode: 0o600 }),
      );
    } finally {
      clearTimeout(timeout);
      source.stream.destroy();
    }

    const video = await this.videos.inspect(path, format);
    const prepared = await this.videos.prepare(path, directory, video, {
      thumbnail:
        !asset.thumbnailKey || !(await this.storage.exists(asset.thumbnailKey)),
      preview:
        !asset.previewKey || !(await this.storage.exists(asset.previewKey)),
      hls:
        !asset.hlsKey ||
        asset.hlsSegmentCount < 1 ||
        !(await this.storage.exists(asset.hlsKey)),
    });
    return {
      ...prepared,
      width: video.width,
      height: video.height,
      durationMs: BigInt(video.durationMs),
      exif: {},
      takenAt: null,
    };
  }

  private async discard(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn(
        `候选派生文件清理失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async discardAll(keys: string[]) {
    for (let offset = 0; offset < keys.length; offset += 16)
      await Promise.all(
        keys.slice(offset, offset + 16).map((key) => this.discard(key)),
      );
  }

  private async discardReplaced(
    asset: FileNode,
    thumbnailKey: string,
    previewKey: string,
    hlsKey: string,
  ) {
    const retired = [
      asset.thumbnailKey !== thumbnailKey ? asset.thumbnailKey : null,
      asset.previewKey !== previewKey ? asset.previewKey : null,
    ].filter((key): key is string => Boolean(key));
    try {
      for (const key of retired) {
        const references = await this.prisma.fileNode.count({
          where: {
            OR: [
              { thumbnailKey: key },
              { previewKey: key },
              { storageKey: key },
            ],
          },
        });
        if (!references) await this.discard(key);
      }
      if (asset.hlsKey && asset.hlsKey !== hlsKey) {
        const references = await this.prisma.fileNode.count({
          where: { hlsKey: asset.hlsKey },
        });
        if (!references)
          await this.discardAll(
            hlsObjectKeys(asset.hlsKey, asset.hlsSegmentCount),
          );
      }
    } catch (error) {
      this.logger.warn(`旧派生文件清理暂缓：${String(error)}`);
    }
  }
}
