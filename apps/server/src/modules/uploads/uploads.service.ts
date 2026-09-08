import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Readable } from 'node:stream';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  FileNode,
  UploadSession,
} from '../../prisma/generated/prisma/client';
import {
  createStorageKey,
  STORAGE_PROVIDER,
  StorageError,
} from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';
import { CreateUploadSessionDto } from './dto/upload.dto';
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_CONCURRENT,
  UPLOAD_SESSION_TTL_MS,
} from './upload.constants';
import { inspectImage, readUploadBody } from './upload-validation';
import { MediaJobsService } from '../jobs/media-jobs.service';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private activeUploads = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaJobs: MediaJobsService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  async createSession(userId: string, dto: CreateUploadSessionDto) {
    const session = await this.prisma.uploadSession.create({
      data: {
        userId,
        fileName: dto.fileName,
        size: BigInt(dto.size),
        hash: dto.hash ?? null,
        storageKey: createStorageKey('originals'),
        status: 'PENDING',
      },
    });

    return this.sessionView(session);
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.findOwnedSession(sessionId, userId);
    return this.sessionView(session);
  }

  async uploadContent(sessionId: string, userId: string, request: Request) {
    const session = await this.findOwnedSession(sessionId, userId);

    if (session.status === 'COMPLETED') {
      if (
        !session.file ||
        session.file.deleted ||
        session.file.ownerId !== userId
      ) {
        throw new GoneException('上传对应的文件已不可用');
      }

      if (!['READY', 'FAILED'].includes(session.file.processingStatus)) {
        await this.mediaJobs.enqueue(session.file.id, userId);
      }

      return this.completedResult(session.id, session.file);
    }

    if (session.createdAt.getTime() + UPLOAD_SESSION_TTL_MS <= Date.now()) {
      throw new GoneException('上传会话已过期，请创建新会话');
    }

    if (session.status !== 'PENDING') {
      throw new ConflictException('会话正在上传或已经结束，请先查询会话状态');
    }

    const expectedBytes = Number(session.size);

    if (
      session.size === null ||
      !Number.isSafeInteger(expectedBytes) ||
      expectedBytes < 1 ||
      expectedBytes > UPLOAD_MAX_BYTES
    ) {
      throw new BadRequestException('上传会话中的文件大小无效');
    }

    this.assertHeaders(request, expectedBytes);

    if (this.activeUploads >= UPLOAD_MAX_CONCURRENT) {
      throw new ServiceUnavailableException('上传繁忙，请稍后重试');
    }

    this.activeUploads += 1;

    let claimed = false;
    let objectWritten = false;

    try {
      const claim = await this.prisma.uploadSession.updateMany({
        where: {
          id: session.id,
          userId,
          status: 'PENDING',
          fileId: null,
          createdAt: {
            gt: new Date(Date.now() - UPLOAD_SESSION_TTL_MS),
          },
        },
        data: {
          status: 'UPLOADING',
        },
      });

      if (claim.count !== 1) {
        throw new ConflictException('会话已被其他请求使用或已过期');
      }

      claimed = true;

      const bytes = await readUploadBody(request, expectedBytes);
      const image = await inspectImage(bytes, session.hash);

      const stored = await this.storage.put(
        session.storageKey,
        Readable.from([bytes]),
      );

      objectWritten = true;

      if (stored.size !== BigInt(expectedBytes)) {
        throw new InternalServerErrorException('存储结果大小不一致');
      }

      const file = await this.prisma.$transaction(async (transaction) => {
        const createdFile = await transaction.fileNode.create({
          data: {
            name: session.fileName,
            type: 'FILE',
            ownerId: userId,
            storageProvider: 'LOCAL_FS',
            storageKey: session.storageKey,
            size: stored.size,
            mimeType: image.mimeType,
            hashAlgorithm: 'BLAKE3',
            hash: image.hash,
            mediaType: 'IMAGE',
            processingStatus: 'PENDING',
            width: image.width,
            height: image.height,
          },
        });

        const completed = await transaction.uploadSession.updateMany({
          where: {
            id: session.id,
            userId,
            status: 'UPLOADING',
            fileId: null,
            createdAt: {
              gt: new Date(Date.now() - UPLOAD_SESSION_TTL_MS),
            },
          },
          data: {
            status: 'COMPLETED',
            fileId: createdFile.id,
            mimeType: image.mimeType,
            hash: image.hash,
          },
        });

        if (completed.count !== 1) {
          throw new ConflictException('会话状态变化或会话已过期');
        }

        return createdFile;
      });

      await this.mediaJobs.enqueue(file.id, userId);

      return this.completedResult(session.id, file);
    } catch (error) {
      if (claimed) {
        await this.compensateFailure(session, objectWritten);
      }

      if (error instanceof StorageError && error.code === 'TOO_LARGE') {
        throw new PayloadTooLargeException('文件超过存储层大小限制');
      }

      throw error;
    } finally {
      this.activeUploads -= 1;
    }
  }

  private async findOwnedSession(sessionId: string, userId: string) {
    const session = await this.prisma.uploadSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        file: true,
      },
    });

    if (!session) {
      throw new NotFoundException('上传会话不存在');
    }

    return session;
  }

  private assertHeaders(request: Request, expectedBytes: number): void {
    const contentType = request.headers['content-type']
      ?.split(';')[0]
      .trim()
      .toLowerCase();

    if (contentType !== 'application/octet-stream') {
      throw new UnsupportedMediaTypeException(
        '请使用 application/octet-stream 上传原始二进制',
      );
    }

    const encoding = request.headers['content-encoding'];

    if (encoding && encoding.toLowerCase() !== 'identity') {
      throw new UnsupportedMediaTypeException(
        '不接受经过 Content-Encoding 压缩的上传请求',
      );
    }

    const contentLength = request.headers['content-length'];

    if (
      contentLength !== undefined &&
      (!/^[0-9]+$/.test(contentLength) ||
        Number(contentLength) !== expectedBytes)
    ) {
      throw new BadRequestException('Content-Length 与会话声明大小不一致');
    }
  }

  private async compensateFailure(
    session: UploadSession,
    objectWritten: boolean,
  ): Promise<void> {
    try {
      const failed = await this.prisma.uploadSession.updateMany({
        where: {
          id: session.id,
          userId: session.userId,
          status: 'UPLOADING',
          fileId: null,
        },
        data: {
          status: 'FAILED',
        },
      });

      if (failed.count === 1 && objectWritten) {
        await this.storage.delete(session.storageKey);
      }
    } catch (error) {
      this.logger.error(
        `上传失败状态更新或文件清理失败：${session.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private completedResult(sessionId: string, file: FileNode) {
    return {
      sessionId,
      status: 'COMPLETED' as const,
      file: this.fileView(file),
    };
  }

  private sessionView(session: UploadSession & { file?: FileNode | null }) {
    const expiresAt = new Date(
      session.createdAt.getTime() + UPLOAD_SESSION_TTL_MS,
    );

    const file =
      session.file &&
      !session.file.deleted &&
      session.file.ownerId === session.userId
        ? this.fileView(session.file)
        : null;

    return {
      id: session.id,
      status: session.status,
      fileName: session.fileName,
      size: session.size?.toString() ?? null,
      expiresAt: expiresAt.toISOString(),
      expired:
        ['PENDING', 'UPLOADING'].includes(session.status) &&
        expiresAt.getTime() <= Date.now(),
      file,
    };
  }

  private fileView(file: FileNode) {
    return {
      id: file.id,
      name: file.name,
      size: file.size?.toString() ?? null,
      mimeType: file.mimeType,
      hash: file.hash,
      width: file.width,
      height: file.height,
      processingStatus: file.processingStatus,
      createdAt: file.createdAt.toISOString(),
    };
  }
}
