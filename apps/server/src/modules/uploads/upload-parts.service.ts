import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request } from 'express';
import { blake3 } from 'hash-wasm';
import { Readable } from 'node:stream';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { UploadSession } from '../../prisma/generated/prisma/client';
import {
  createStorageKey,
  STORAGE_PROVIDER,
} from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';
import { assertUploadHeaders, readUploadBody } from './upload-validation';
import { UPLOAD_PART_MAX_CONCURRENT } from './upload.constants';

@Injectable()
export class UploadPartsService {
  private readonly logger = new Logger(UploadPartsService.name);
  private active = 0;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async put(session: UploadSession, index: number, request: Request) {
    if (
      !session.chunkSize ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= session.chunkCount
    )
      throw new BadRequestException('分片序号无效');
    if (session.status !== 'PENDING')
      throw new ConflictException('会话已结束或正在合并，请查询会话状态');
    const size = Math.min(
      session.chunkSize,
      Number(session.size) - index * session.chunkSize,
    );
    assertUploadHeaders(request, size);
    const hash = request.headers['x-chunk-hash'];
    if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash))
      throw new BadRequestException('X-Chunk-Hash 必须是分片的 BLAKE3 摘要');
    if (this.active >= UPLOAD_PART_MAX_CONCURRENT)
      throw new ServiceUnavailableException('分片上传繁忙，请稍后重试');
    this.active += 1;
    let candidate: string | undefined;
    try {
      const bytes = await readUploadBody(request, size);
      if ((await blake3(bytes)) !== hash)
        throw new UnprocessableEntityException('分片 BLAKE3 校验失败');
      const existing = await this.prisma.uploadPart.findUnique({
        where: { sessionId_index: { sessionId: session.id, index } },
      });
      if (existing) {
        if (existing.hash !== hash || existing.size !== size)
          throw new ConflictException('已上传的同序号分片与本次内容不一致');
        if (
          (await this.storage.stat(existing.storageKey))?.size === BigInt(size)
        )
          return { index, size, hash };
      }
      candidate = createStorageKey('uploads');
      const stored = await this.storage.put(candidate, Readable.from([bytes]));
      if (stored.size !== BigInt(size))
        throw new ServiceUnavailableException('分片存储不完整');
      const key = candidate;
      const oldKey = await this.prisma.$transaction(async (transaction) => {
        const claimed = await transaction.uploadSession.updateMany({
          where: { id: session.id, userId: session.userId, status: 'PENDING' },
          data: { updatedAt: new Date() },
        });
        if (claimed.count !== 1)
          throw new ConflictException('会话已结束或开始合并');
        const part = await transaction.uploadPart.findUnique({
          where: { sessionId_index: { sessionId: session.id, index } },
        });
        if (part && (part.hash !== hash || part.size !== size))
          throw new ConflictException('分片内容冲突，请重新创建上传会话');
        await transaction.uploadPart.upsert({
          where: { sessionId_index: { sessionId: session.id, index } },
          create: { sessionId: session.id, index, hash, size, storageKey: key },
          update: { storageKey: key },
        });
        return part?.storageKey;
      });
      candidate = undefined;
      if (oldKey) await this.discard(oldKey);
      return { index, size, hash };
    } finally {
      this.active -= 1;
      if (candidate) {
        const key = candidate;
        await this.prisma.uploadPart
          .findUnique({ where: { storageKey: key } })
          .then((part) => (part ? undefined : this.discard(key)))
          .catch(() => undefined);
      }
    }
  }

  async open(session: UploadSession): Promise<Readable> {
    const parts = await this.prisma.uploadPart.findMany({
      where: { sessionId: session.id },
      orderBy: { index: 'asc' },
    });
    if (
      parts.length !== session.chunkCount ||
      parts.some(
        (part, index) =>
          part.index !== index ||
          part.size !==
            Math.min(
              session.chunkSize,
              Number(session.size) - index * session.chunkSize,
            ),
      )
    )
      throw new ConflictException('分片尚未上传完整，请查询并补传缺失分片');
    const storage = this.storage;
    async function* content() {
      for (const part of parts) {
        const opened = await storage.read(part.storageKey).catch(() => {
          throw new ServiceUnavailableException('分片暂时无法读取，请重试');
        });
        try {
          if (opened.stat.size !== BigInt(part.size))
            throw new UnprocessableEntityException('已存储的分片大小不一致');
          yield* opened.stream;
        } finally {
          opened.stream.destroy();
        }
      }
    }
    return Readable.from(content());
  }

  async cleanup(sessionId: string) {
    const parts = await this.prisma.uploadPart.findMany({
      where: { sessionId },
    });
    for (const part of parts) {
      await this.storage.delete(part.storageKey);
      await this.prisma.uploadPart.deleteMany({
        where: { sessionId, index: part.index, storageKey: part.storageKey },
      });
    }
  }

  private async discard(key: string) {
    await this.storage.delete(key).catch((error: unknown) => {
      this.logger.warn(
        `分片清理暂缓：${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }
}
