import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import {
  isVideoFormat,
  mediaByteLimit,
  mediaFormat,
} from '../../common/media-formats';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  FileNode,
  UploadSession,
} from '../../prisma/generated/prisma/client';
import { MediaJobsService } from '../jobs/media-jobs.service';
import { MediaProcessingError } from '../jobs/media-processing.constants';
import { VideoProcessorService } from '../jobs/video-processor.service';
import { VideoSummariesService } from '../video-summaries/video-summaries.service';
import {
  createStorageKey,
  STORAGE_PROVIDER,
  StorageError,
} from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';
import { CreateUploadSessionDto } from './dto/upload.dto';
import { UploadPartsService } from './upload-parts.service';
import {
  UPLOAD_CHUNK_BYTES,
  UPLOAD_CLEANUP_INTERVAL_MS,
  UPLOAD_MAX_CONCURRENT,
  UPLOAD_MERGE_LEASE_MS,
  UPLOAD_MULTIPART_TTL_MS,
  UPLOAD_SESSION_TTL_MS,
} from './upload.constants';
import {
  assertUploadHeaders,
  inspectImage,
  readUploadBody,
  stageVideoUpload,
} from './upload-validation';

type OwnedSession = UploadSession & { file: FileNode | null };

@Injectable()
export class UploadsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UploadsService.name);
  private activeUploads = 0;
  private cleanupTimer?: NodeJS.Timeout;
  private cleanupWork?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaJobs: MediaJobsService,
    private readonly videos: VideoProcessorService,
    private readonly parts: UploadPartsService,
    private readonly config: ConfigService,
    private readonly videoSummaries: VideoSummariesService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  onModuleInit() {
    this.cleanupTimer = setInterval(
      () => this.scheduleCleanup(),
      UPLOAD_CLEANUP_INTERVAL_MS,
    );
    this.cleanupTimer.unref();
    this.scheduleCleanup();
  }

  async onModuleDestroy() {
    clearInterval(this.cleanupTimer);
    await this.cleanupWork;
  }

  async createSession(userId: string, dto: CreateUploadSessionDto) {
    const format = mediaFormat(dto.fileName);
    if (!format) throw new UnsupportedMediaTypeException('不支持此文件扩展名');
    const limit = Math.min(
      mediaByteLimit(format),
      this.config.getOrThrow<number>('STORAGE_MAX_FILE_BYTES'),
    );
    if (dto.size > limit)
      throw new PayloadTooLargeException(
        `文件超过大小限制（${Math.floor(limit / 1024 / 1024)} MiB）`,
      );
    const chunked = dto.size > UPLOAD_CHUNK_BYTES;
    if (chunked && !dto.hash)
      throw new BadRequestException(
        '超过 5 MiB 的文件必须提供 BLAKE3 摘要并使用分片上传',
      );

    if (dto.hash) {
      const existing = await this.prisma.uploadSession.findFirst({
        where: {
          userId,
          hash: dto.hash,
          size: BigInt(dto.size),
          status: 'COMPLETED',
          file: {
            ownerId: userId,
            deleted: false,
            type: 'FILE',
            hashAlgorithm: 'BLAKE3',
            hash: dto.hash,
            size: BigInt(dto.size),
            storageProvider: 'LOCAL_FS',
            storageKey: { not: null },
          },
        },
        include: { file: true },
        orderBy: { createdAt: 'desc' },
      });
      if (existing?.file?.storageKey) {
        const metadata = await this.storage.stat(existing.file.storageKey);
        if (metadata?.size === existing.file.size) {
          await this.enqueue(existing.file);
          return this.sessionView(existing, true);
        }
      }
      if (chunked) {
        const resumable = await this.prisma.uploadSession.findFirst({
          where: {
            userId,
            hash: dto.hash,
            size: BigInt(dto.size),
            fileName: dto.fileName,
            chunkSize: UPLOAD_CHUNK_BYTES,
            status: { in: ['PENDING', 'UPLOADING'] },
            createdAt: { gt: new Date(Date.now() - UPLOAD_MULTIPART_TTL_MS) },
          },
          include: { file: true },
          orderBy: { createdAt: 'desc' },
        });
        if (resumable) return this.sessionView(resumable);
      }
    }
    const session = await this.prisma.uploadSession.create({
      data: {
        userId,
        fileName: dto.fileName,
        size: BigInt(dto.size),
        hash: dto.hash ?? null,
        storageKey: createStorageKey('originals'),
        chunkSize: chunked ? UPLOAD_CHUNK_BYTES : null,
        chunkCount: chunked ? Math.ceil(dto.size / UPLOAD_CHUNK_BYTES) : null,
      },
      include: { file: true },
    });
    return this.sessionView(session);
  }

  async getSession(sessionId: string, userId: string) {
    return this.sessionView(await this.findOwnedSession(sessionId, userId));
  }

  async getProgress(sessionId: string, userId: string) {
    const { status, expired, merging, file } = await this.sessionView(
      await this.findOwnedSession(sessionId, userId),
      false,
      false,
    );
    return { status, expired, merging, file };
  }

  async uploadContent(sessionId: string, userId: string, request: Request) {
    const session = await this.findOwnedSession(sessionId, userId);
    if (session.status === 'COMPLETED') return this.completedSession(session);
    this.assertUsable(session);
    if (Number(session.size) > UPLOAD_CHUNK_BYTES)
      throw new BadRequestException(
        '超过 5 MiB 请使用分片接口上传，再调用 complete 合并',
      );
    assertUploadHeaders(request, Number(session.size));
    return this.receiveContent(session, async () => request);
  }

  async uploadPart(
    sessionId: string,
    userId: string,
    index: number,
    request: Request,
  ) {
    const session = await this.findOwnedSession(sessionId, userId);
    this.assertUsable(session);
    return this.parts.put(session, index, request);
  }

  async complete(sessionId: string, userId: string) {
    const session = await this.findOwnedSession(sessionId, userId);
    if (session.status === 'COMPLETED') return this.completedSession(session);
    this.assertUsable(session);
    if (!session.chunkSize) throw new BadRequestException('此会话不是分片上传');
    return this.receiveContent(session, () => this.parts.open(session));
  }

  async cancel(sessionId: string, userId: string) {
    const session = await this.findOwnedSession(sessionId, userId);
    if (session.status === 'COMPLETED')
      throw new ConflictException('上传已经完成，请在媒体库中删除文件');
    const cancelled = await this.prisma.uploadSession.updateMany({
      where: {
        id: session.id,
        userId,
        status: { in: ['PENDING', 'UPLOADING', 'FAILED', 'CANCELLED'] },
      },
      data: { status: 'CANCELLED', mergeToken: null, mergeLeaseUntil: null },
    });
    if (cancelled.count !== 1) throw new ConflictException('会话状态已变化');
    await this.cleanupParts(session.id);
    return { id: session.id, status: 'CANCELLED' as const };
  }

  private async receiveContent(
    session: OwnedSession,
    openContent: () => Promise<Readable>,
  ) {
    if (this.activeUploads >= UPLOAD_MAX_CONCURRENT)
      throw new ServiceUnavailableException('上传校验繁忙，请稍后重试');
    this.activeUploads += 1;
    const mergeToken = randomUUID();
    const storageKey = createStorageKey('originals');
    let claimed = false;
    let objectWritten = false;
    let linkAttempted = false;
    let source: Readable | undefined;
    let stagedVideo: Awaited<ReturnType<typeof stageVideoUpload>> | undefined;
    let stopHeartbeat: (() => Promise<void>) | undefined;
    try {
      const now = new Date();
      const claim = await this.prisma.uploadSession.updateMany({
        where: {
          id: session.id,
          userId: session.userId,
          fileId: null,
          OR: [
            { status: 'PENDING' },
            { status: 'UPLOADING', mergeLeaseUntil: { lte: now } },
            { status: 'UPLOADING', mergeLeaseUntil: null },
          ],
        },
        data: {
          status: 'UPLOADING',
          mergeToken,
          mergeLeaseUntil: new Date(now.getTime() + UPLOAD_MERGE_LEASE_MS),
        },
      });
      if (claim.count !== 1)
        throw new ConflictException('会话正在合并或已经结束，请查询会话状态');
      claimed = true;
      stopHeartbeat = this.maintainLease(session.id, mergeToken);
      source = await openContent();
      const expectedBytes = Number(session.size);
      const format = mediaFormat(session.fileName);
      let media: {
        mediaType: 'IMAGE' | 'VIDEO';
        mimeType: string;
        hash: string;
        width: number;
        height: number;
        durationMs: number | null;
      };
      let content: Readable;
      if (isVideoFormat(format)) {
        stagedVideo = await stageVideoUpload(
          source,
          expectedBytes,
          session.hash,
        );
        media = {
          ...(await this.videos.inspect(stagedVideo.path, format)),
          hash: stagedVideo.hash,
        };
        content = createReadStream(stagedVideo.path);
      } else {
        const bytes = await readUploadBody(source, expectedBytes);
        media = await inspectImage(bytes, session.hash, format);
        content = Readable.from([bytes]);
      }
      const stored = await this.storage.put(storageKey, content);
      objectWritten = true;
      if (stored.size !== BigInt(expectedBytes))
        throw new InternalServerErrorException('存储结果大小不一致');
      linkAttempted = true;
      const file = await this.prisma.$transaction(async (transaction) => {
        const createdFile = await transaction.fileNode.create({
          data: {
            name: session.fileName,
            type: 'FILE',
            ownerId: session.userId,
            storageProvider: 'LOCAL_FS',
            storageKey,
            size: stored.size,
            mimeType: media.mimeType,
            hashAlgorithm: 'BLAKE3',
            hash: media.hash,
            mediaType: media.mediaType,
            processingStatus: 'PENDING',
            width: media.width,
            height: media.height,
            durationMs:
              media.durationMs === null ? null : BigInt(media.durationMs),
            ...(media.mediaType === 'VIDEO' && this.videoSummaries.autoSummarize
              ? { videoSummary: { create: { sourceHash: media.hash } } }
              : {}),
          },
        });
        const completed = await transaction.uploadSession.updateMany({
          where: {
            id: session.id,
            userId: session.userId,
            status: 'UPLOADING',
            mergeToken,
            fileId: null,
          },
          data: {
            status: 'COMPLETED',
            fileId: createdFile.id,
            storageKey,
            mimeType: media.mimeType,
            hash: media.hash,
            mergeToken: null,
            mergeLeaseUntil: null,
          },
        });
        if (completed.count !== 1)
          throw new ConflictException('会话已取消或合并租约已变化');
        return createdFile;
      });
      await this.cleanupParts(session.id);
      await this.enqueue(file);
      return this.completedResult(session.id, file);
    } catch (error) {
      if (linkAttempted) {
        const current = await this.findOwnedSession(
          session.id,
          session.userId,
        ).catch(() => null);
        if (current?.status === 'COMPLETED' && current.file)
          return this.completedSession(current);
        if (current && current.fileId === null) linkAttempted = false;
      }
      if (claimed) {
        const permanent =
          error instanceof UnprocessableEntityException ||
          (error instanceof MediaProcessingError && error.permanent);
        const status = session.chunkSize && !permanent ? 'PENDING' : 'FAILED';
        const released = await this.prisma.uploadSession
          .updateMany({
            where: {
              id: session.id,
              status: 'UPLOADING',
              mergeToken,
              fileId: null,
            },
            data: { status, mergeToken: null, mergeLeaseUntil: null },
          })
          .catch((failure: unknown) => {
            this.logger.warn(`上传状态恢复暂缓：${String(failure)}`);
            return null;
          });
        if (objectWritten && !linkAttempted)
          await this.storage.delete(storageKey).catch(() => undefined);
        if (status === 'FAILED' && released?.count === 1)
          await this.cleanupParts(session.id);
      }
      if (error instanceof StorageError && error.code === 'TOO_LARGE')
        throw new PayloadTooLargeException('文件超过存储层大小限制');
      if (error instanceof MediaProcessingError) {
        if (error.permanent)
          throw new UnprocessableEntityException(error.message);
        throw new ServiceUnavailableException({
          code: 'VIDEO_PROCESSING_UNAVAILABLE',
          message: error.message,
        });
      }
      throw error;
    } finally {
      this.activeUploads -= 1;
      await stopHeartbeat?.();
      if (source && !('headers' in source)) source.destroy();
      await stagedVideo
        ?.cleanup()
        .catch((error: unknown) =>
          this.logger.warn(`上传临时文件清理失败：${String(error)}`),
        );
    }
  }

  private maintainLease(sessionId: string, mergeToken: string) {
    let renewal: Promise<unknown> | undefined;
    const timer = setInterval(
      () => {
        if (renewal) return;
        renewal = this.prisma.uploadSession
          .updateMany({
            where: { id: sessionId, status: 'UPLOADING', mergeToken },
            data: {
              mergeLeaseUntil: new Date(Date.now() + UPLOAD_MERGE_LEASE_MS),
            },
          })
          .then((result) => {
            if (result.count !== 1) clearInterval(timer);
          })
          .catch((error: unknown) =>
            this.logger.warn(`上传合并租约续期暂缓：${String(error)}`),
          )
          .finally(() => {
            renewal = undefined;
          });
      },
      Math.floor(UPLOAD_MERGE_LEASE_MS / 3),
    );
    timer.unref();
    return async () => {
      clearInterval(timer);
      await renewal;
    };
  }

  private assertUsable(session: UploadSession) {
    const ttl = session.chunkSize
      ? UPLOAD_MULTIPART_TTL_MS
      : UPLOAD_SESSION_TTL_MS;
    if (session.createdAt.getTime() + ttl <= Date.now())
      throw new GoneException('上传会话已过期，请重新选择文件');
    if (!['PENDING', 'UPLOADING'].includes(session.status))
      throw new ConflictException('上传会话已经结束，请重新创建');
    const format = mediaFormat(session.fileName);
    if (
      !format ||
      !session.size ||
      session.size < 1n ||
      session.size > BigInt(mediaByteLimit(format))
    )
      throw new BadRequestException('上传会话中的文件格式或大小无效');
  }

  private async findOwnedSession(
    sessionId: string,
    userId: string,
  ): Promise<OwnedSession> {
    const session = await this.prisma.uploadSession.findFirst({
      where: { id: sessionId, userId },
      include: { file: true },
    });
    if (!session) throw new NotFoundException('上传会话不存在');
    return session;
  }

  private async completedSession(session: OwnedSession) {
    if (
      !session.file ||
      session.file.deleted ||
      session.file.ownerId !== session.userId
    )
      throw new GoneException('上传对应的文件已不可用');
    await this.enqueue(session.file);
    return this.completedResult(session.id, session.file);
  }

  private async enqueue(file: FileNode) {
    await this.videoSummaries.enqueueAutomatic(file).catch(() => {
      this.logger.warn(`视频 ${file.id} 的总结入队暂缓，可在视频详情中重试`);
    });
    if (['READY', 'FAILED'].includes(file.processingStatus)) return;
    await this.mediaJobs
      .enqueue(file.id, file.ownerId)
      .catch((error: unknown) => {
        this.logger.warn(`媒体任务等待后台补投：${file.id} ${String(error)}`);
      });
  }

  private completedResult(sessionId: string, file: FileNode) {
    return {
      sessionId,
      status: 'COMPLETED' as const,
      file: this.fileView(file),
    };
  }

  private async sessionView(
    session: OwnedSession,
    instant = false,
    verifyParts = true,
  ) {
    const ttl = session.chunkSize
      ? UPLOAD_MULTIPART_TTL_MS
      : UPLOAD_SESSION_TTL_MS;
    const expiresAt = new Date(session.createdAt.getTime() + ttl);
    const storedParts =
      verifyParts && session.chunkSize && session.status !== 'COMPLETED'
        ? await this.prisma.uploadPart.findMany({
            where: { sessionId: session.id },
            select: { index: true, size: true, storageKey: true },
            orderBy: { index: 'asc' },
          })
        : [];
    const parts: { index: number; size: number }[] = [];
    for (let offset = 0; offset < storedParts.length; offset += 16) {
      const available = await Promise.all(
        storedParts.slice(offset, offset + 16).map(async (part) => {
          const metadata = await this.storage.stat(part.storageKey);
          return metadata?.size === BigInt(part.size) ? part : null;
        }),
      );
      parts.push(...available.filter((part) => part !== null));
    }
    return {
      id: session.id,
      status: session.status,
      fileName: session.fileName,
      size: session.size?.toString() ?? null,
      expiresAt: expiresAt.toISOString(),
      expired:
        ['PENDING', 'UPLOADING'].includes(session.status) &&
        expiresAt.getTime() <= Date.now(),
      mode: session.chunkSize ? ('CHUNKED' as const) : ('DIRECT' as const),
      chunkSize: session.chunkSize,
      chunkCount: session.chunkCount,
      uploadedParts: parts.map((part) => part.index),
      uploadedBytes:
        session.status === 'COMPLETED'
          ? Number(session.size)
          : parts.reduce((total, part) => total + part.size, 0),
      merging:
        session.status === 'UPLOADING' &&
        (session.mergeLeaseUntil?.getTime() ?? 0) > Date.now(),
      instant,
      file:
        session.file &&
        !session.file.deleted &&
        session.file.ownerId === session.userId
          ? this.fileView(session.file)
          : null,
    };
  }

  private fileView(file: FileNode) {
    return {
      id: file.id,
      name: file.name,
      size: file.size?.toString() ?? null,
      mimeType: file.mimeType,
      mediaType: file.mediaType,
      durationMs: file.durationMs?.toString() ?? null,
      hash: file.hash,
      width: file.width,
      height: file.height,
      processingStatus: file.processingStatus,
      createdAt: file.createdAt.toISOString(),
    };
  }

  private async cleanupParts(sessionId: string) {
    await this.parts
      .cleanup(sessionId)
      .catch((error: unknown) =>
        this.logger.warn(`分片清理等待重试：${sessionId} ${String(error)}`),
      );
  }

  private scheduleCleanup() {
    if (this.cleanupWork) return;
    this.cleanupWork = this.cleanupExpired()
      .catch((error: unknown) => {
        this.logger.warn(`过期上传清理暂缓：${String(error)}`);
      })
      .finally(() => {
        this.cleanupWork = undefined;
      });
  }

  private async cleanupExpired() {
    const now = new Date();
    await this.prisma.uploadSession.updateMany({
      where: {
        chunkSize: { not: null },
        createdAt: { lte: new Date(now.getTime() - UPLOAD_MULTIPART_TTL_MS) },
        OR: [
          { status: 'PENDING' },
          { status: 'UPLOADING', mergeLeaseUntil: { lte: now } },
          { status: 'UPLOADING', mergeLeaseUntil: null },
        ],
      },
      data: { status: 'CANCELLED', mergeToken: null, mergeLeaseUntil: null },
    });
    const sessions = await this.prisma.uploadSession.findMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
        parts: { some: {} },
      },
      select: { id: true },
      take: 25,
      orderBy: { createdAt: 'asc' },
    });
    for (let offset = 0; offset < sessions.length; offset += 2)
      await Promise.all(
        sessions
          .slice(offset, offset + 2)
          .map((session) => this.cleanupParts(session.id)),
      );
  }
}
