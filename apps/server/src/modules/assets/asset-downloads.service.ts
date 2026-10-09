import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { RedisKey } from '../../common/constants';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import type { RequestUser } from '../iam/auth/auth.type';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { createAssetArchive, type ArchiveAsset } from './asset-archive';
import {
  attachmentDisposition,
  isMediaResponseClosed,
} from './asset-file-response';
import { assetWhere } from './asset-scope';
import {
  MediaStreamService,
  type DownloadAuthorization,
} from './media-stream.service';

const ARCHIVE_TICKET_TTL_MS = 15 * 60 * 1000;
const MAX_ARCHIVE_DOWNLOADS = 2;

interface ArchiveTicket extends DownloadAuthorization {
  ids: string[];
  expiresAt: number;
  fileName: string;
}

@Injectable()
export class AssetDownloadsService {
  private readonly logger = new Logger(AssetDownloadsService.name);
  private activeDownloads = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly streams: MediaStreamService,
  ) {}

  async createTicket(ids: string[], user: RequestUser) {
    const assets = await this.findOwned(ids, user.id);
    await this.verifyStorage(assets);
    const now = Date.now();
    const expiresAt = user.sessionId
      ? now + ARCHIVE_TICKET_TTL_MS
      : Math.min(now + ARCHIVE_TICKET_TTL_MS, user.tokenExp * 1000);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }
    const ticket = randomBytes(32).toString('base64url');
    const fileName = `imageStack-${new Date(now).toISOString().replace(/[:.]/g, '-')}.zip`;
    const payload: ArchiveTicket = {
      ids,
      userId: user.id,
      sessionVersion: user.sessionVersion ?? 0,
      sessionId: user.sessionId,
      tokenJti: user.tokenJti,
      expiresAt,
      fileName,
    };
    await this.redis.set(
      RedisKey.archiveDownload(ticket),
      JSON.stringify(payload),
      Math.ceil((expiresAt - now) / 1000),
    );
    return {
      path: `/assets/downloads/archive?ticket=${ticket}`,
      fileName,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async stream(ticket: string, request: Request, response: Response) {
    const payload = await this.readTicket(ticket);
    await this.streams.authorizeDownload(payload);
    if (isMediaResponseClosed(request, response)) return;
    if (this.activeDownloads >= MAX_ARCHIVE_DOWNLOADS) {
      throw new ServiceUnavailableException(
        '打包下载繁忙，请稍后重试或选择单独下载',
      );
    }
    this.activeDownloads += 1;
    try {
      const assets = await this.findOwned(payload.ids, payload.userId);
      await this.verifyStorage(assets);
      if (isMediaResponseClosed(request, response)) return;
      response.status(200);
      response.setHeader('Content-Type', 'application/zip');
      response.setHeader(
        'Content-Disposition',
        attachmentDisposition(payload.fileName),
      );
      response.setHeader('Cache-Control', 'private, no-store');
      response.setHeader('Accept-Ranges', 'none');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Referrer-Policy', 'no-referrer');
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      const archive = createAssetArchive(this.storage, assets);
      let clientDisconnected = false;
      const onClose = () => {
        if (!response.writableFinished && !archive.errored)
          clientDisconnected = true;
      };
      response.once('close', onClose);
      try {
        await pipeline(archive, response);
      } catch (error) {
        if (!clientDisconnected) {
          this.logger.error(
            `ZIP 下载失败：${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } finally {
        response.off('close', onClose);
        archive.destroy();
        if (!response.destroyed && !response.writableEnded) response.destroy();
      }
    } finally {
      this.activeDownloads -= 1;
    }
  }

  private async readTicket(ticket: string): Promise<ArchiveTicket> {
    if (typeof ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) {
      throw new UnauthorizedException('下载凭证无效或已过期，请重新发起下载');
    }
    const stored = await this.redis.get(RedisKey.archiveDownload(ticket));
    let payload: ArchiveTicket;
    try {
      payload = JSON.parse(stored ?? 'null') as ArchiveTicket;
    } catch {
      throw new UnauthorizedException('下载凭证无效或已过期，请重新发起下载');
    }
    if (
      !payload ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      throw new UnauthorizedException('下载凭证无效或已过期，请重新发起下载');
    }
    return payload;
  }

  private async findOwned(
    ids: string[],
    userId: string,
  ): Promise<ArchiveAsset[]> {
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 100 ||
      new Set(ids).size !== ids.length
    ) {
      throw new BadRequestException('每次请选择 1 至 100 个不同的文件');
    }
    const assets = await this.prisma.fileNode.findMany({
      where: { ...assetWhere(userId), id: { in: ids } },
      select: {
        id: true,
        name: true,
        size: true,
        mediaType: true,
        createdAt: true,
        storageProvider: true,
        storageBucket: true,
        storageKey: true,
      },
    });
    if (assets.length !== ids.length)
      throw new NotFoundException('部分文件不存在或无权下载');
    if (
      assets.some(
        (asset) =>
          asset.size === null ||
          asset.size < 1n ||
          asset.size > BigInt(Number.MAX_SAFE_INTEGER),
      )
    ) {
      throw new ConflictException('部分文件的大小信息无效');
    }
    const indexed = new Map(assets.map((asset) => [asset.id, asset]));
    return ids.map((id) => indexed.get(id));
  }

  private async verifyStorage(assets: ArchiveAsset[]) {
    for (let offset = 0; offset < assets.length; offset += 8) {
      await Promise.all(
        assets.slice(offset, offset + 8).map(async (asset) => {
          const metadata = await this.storage.for(asset).stat(asset.storageKey);
          if (!metadata)
            throw new NotFoundException('部分原文件已不可用，请刷新后重试');
          if (metadata.size !== asset.size)
            throw new ConflictException('原文件大小发生变化，请刷新后重试');
        }),
      );
    }
  }
}
