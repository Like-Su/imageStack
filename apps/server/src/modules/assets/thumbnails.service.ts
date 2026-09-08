import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { FileNode } from '../../prisma/generated/prisma/client';
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

@Injectable()
export class ThumbnailsService {
  private readonly logger = new Logger(ThumbnailsService.name);
  private readonly jobs = new Map<string, Promise<string>>();
  private readonly waiters: Array<() => void> = [];
  private active = 0;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  async getOrCreate(asset: FileNode): Promise<string> {
    if (asset.thumbnailKey && (await this.storage.exists(asset.thumbnailKey))) {
      return asset.thumbnailKey;
    }

    const existing = this.jobs.get(asset.id);

    if (existing) {
      return existing;
    }

    if (this.jobs.size >= 64) {
      throw new ServiceUnavailableException('缩略图生成队列已满，请稍后重试');
    }

    const job = this.withSlot(() => this.generate(asset)).finally(() =>
      this.jobs.delete(asset.id),
    );

    this.jobs.set(asset.id, job);

    return job;
  }

  private async withSlot<Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> {
    if (this.active >= 2) {
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
    } else {
      this.active += 1;
    }

    try {
      return await operation();
    } finally {
      const next = this.waiters.shift();

      if (next) {
        next();
      } else {
        this.active -= 1;
      }
    }
  }

  private async generate(asset: FileNode): Promise<string> {
    if (
      !asset.storageKey ||
      asset.size === null ||
      asset.size <= 0n ||
      asset.size > BigInt(UPLOAD_MAX_BYTES)
    ) {
      throw new UnprocessableEntityException('原图大小或存储信息无效');
    }

    const source = await this.storage
      .read(asset.storageKey)
      .catch((error: unknown) => {
        if (error instanceof StorageError && error.code === 'NOT_FOUND') {
          throw new NotFoundException('原图对象不存在');
        }

        throw error;
      });

    const chunks: Buffer[] = [];
    let receivedBytes = 0;

    try {
      if (source.stat.size !== asset.size) {
        throw new InternalServerErrorException('原图大小与记录不一致');
      }

      for await (const chunk of source.stream) {
        if (!Buffer.isBuffer(chunk)) {
          throw new InternalServerErrorException('存储流格式无效');
        }

        receivedBytes += chunk.length;

        if (receivedBytes > UPLOAD_MAX_BYTES) {
          throw new UnprocessableEntityException('原图超过处理限制');
        }

        chunks.push(chunk);
      }

      if (BigInt(receivedBytes) !== asset.size) {
        throw new InternalServerErrorException('原图读取不完整');
      }
    } finally {
      source.stream.destroy();
    }

    let thumbnail: Buffer;

    try {
      thumbnail = await sharp(Buffer.concat(chunks, receivedBytes), {
        failOn: 'warning',
        limitInputPixels: UPLOAD_MAX_PIXELS,
      })
        .rotate()
        .resize({
          width: 256,
          height: 256,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .timeout({ seconds: 10 })
        .toBuffer();
    } catch {
      throw new UnprocessableEntityException('无法解码原图或生成缩略图');
    }

    const key = createStorageKey('derived');

    await this.storage.put(key, Readable.from([thumbnail]));

    let updated: { count: number };

    try {
      updated = await this.prisma.fileNode.updateMany({
        where: {
          id: asset.id,
          ownerId: asset.ownerId,
          deleted: asset.deleted,
          type: 'FILE',
          mediaType: 'IMAGE',
          storageKey: asset.storageKey,
          thumbnailKey: asset.thumbnailKey,
        },
        data: {
          thumbnailKey: key,
        },
      });
    } catch (error) {
      this.logger.error(
        `缩略图关联结果未确认，保留对象等待清理：${asset.id}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }

    if (updated.count === 1) {
      return key;
    }

    await this.discard(key);

    const current = await this.prisma.fileNode.findFirst({
      where: {
        id: asset.id,
        ownerId: asset.ownerId,
        deleted: asset.deleted,
        type: 'FILE',
        mediaType: 'IMAGE',
        storageKey: asset.storageKey,
      },
      select: {
        thumbnailKey: true,
      },
    });

    if (!current) {
      throw new NotFoundException('资产已不存在');
    }

    if (!current.thumbnailKey) {
      throw new ConflictException('缩略图状态发生变化，请重试');
    }

    return current.thumbnailKey;
  }

  private async discard(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn(
        `候选缩略图清理失败：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
