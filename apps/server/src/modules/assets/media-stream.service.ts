import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PermissionCode, RedisKey, RoleCode } from '../../common/constants';
import { VIDEO_MAX_DURATION_MS } from '../../common/media-formats';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  HLS_MAX_PLAYLIST_BYTES,
  HLS_MAX_SEGMENTS,
  HLS_PLAYLIST_NAME,
  HLS_SEGMENT_PATTERN,
  hlsSegmentKey,
  hlsSegmentName,
} from '../../common/video-stream';
import { assetMediaSelect, type MediaAsset } from './asset-media';
import type { RequestUser } from '../iam/auth/auth.type';
import { UserService } from '../iam/user/user.service';
import { MediaJobsService } from '../jobs/media-jobs.service';
import { STORAGE_PROVIDER } from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';
import { assetWhere } from './asset-scope';
import type { MediaStreamDto } from './dto/media-stream.dto';

const STREAM_TICKET_TTL_MS = VIDEO_MAX_DURATION_MS + 15 * 60 * 1000;

interface StreamTicket {
  assetId: string;
  userId: string;
  kind: MediaStreamDto['kind'];
  expiresAt: number;
  sessionVersion: number;
  sessionId?: string;
  tokenJti: string;
}

@Injectable()
export class MediaStreamService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly users: UserService,
    private readonly jobs: MediaJobsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async createTicket(
    assetId: string,
    user: RequestUser,
    kind: MediaStreamDto['kind'],
  ) {
    const asset = await this.findOwned(assetId, user.id);
    if (kind === 'hls') await this.ensureHls(asset);
    const expiresAt = user.sessionId
      ? Date.now() + STREAM_TICKET_TTL_MS
      : Math.min(Date.now() + STREAM_TICKET_TTL_MS, user.tokenExp * 1000);
    const payload: StreamTicket = {
      assetId,
      userId: user.id,
      kind,
      expiresAt,
      sessionVersion: user.sessionVersion ?? 0,
      sessionId: user.sessionId,
      tokenJti: user.tokenJti,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const ticket = `${encoded}.${this.signature(encoded).toString('base64url')}`;
    const fileName = kind === 'hls' ? HLS_PLAYLIST_NAME : 'file';
    return {
      kind,
      expiresAt: new Date(expiresAt).toISOString(),
      path: `/assets/${encodeURIComponent(assetId)}/stream/${fileName}?ticket=${encodeURIComponent(ticket)}`,
    };
  }

  async resource(assetId: string, fileName: string, ticket: string) {
    const payload = this.verify(ticket, assetId);
    await this.authorize(payload);
    const asset = await this.findOwned(assetId, payload.userId);
    if (fileName === 'file' && payload.kind !== 'hls') {
      const encodedName = encodeURIComponent(asset.name).replace(
        /['()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
      );
      return {
        key: asset.storageKey,
        mimeType: asset.mimeType,
        disposition:
          payload.kind === 'download'
            ? `attachment; filename="download"; filename*=UTF-8''${encodedName}`
            : 'inline',
      };
    }
    if (payload.kind !== 'hls')
      throw new ForbiddenException('播放凭证不允许访问此资源');
    if (
      !asset.hlsKey ||
      asset.hlsSegmentCount < 1 ||
      asset.hlsSegmentCount > HLS_MAX_SEGMENTS
    )
      throw new NotFoundException('HLS 视频尚未生成');
    if (fileName === HLS_PLAYLIST_NAME)
      return { playlist: await this.playlist(asset, ticket) };
    const matched = HLS_SEGMENT_PATTERN.exec(fileName);
    const index = matched ? Number(matched[1]) : -1;
    if (index < 0 || index >= asset.hlsSegmentCount)
      throw new NotFoundException('视频分段不存在');
    return {
      key: hlsSegmentKey(asset.hlsKey, index),
      mimeType: 'video/mp2t',
      disposition: 'inline',
    };
  }

  private signature(encoded: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`media-stream:${encoded}`)
      .digest();
  }

  private verify(ticket: string, assetId: string): StreamTicket {
    if (
      typeof ticket !== 'string' ||
      ticket.length > 2048 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ticket)
    )
      throw new UnauthorizedException('缺少有效的媒体播放凭证');
    const [encoded, signature] = ticket.split('.');
    const supplied = Buffer.from(signature, 'base64url');
    const expected = this.signature(encoded);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw new UnauthorizedException('媒体播放凭证无效');
    let payload: StreamTicket;
    try {
      payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as StreamTicket;
    } catch {
      throw new UnauthorizedException('媒体播放凭证格式无效');
    }
    if (
      !payload ||
      payload.assetId !== assetId ||
      typeof payload.userId !== 'string' ||
      typeof payload.tokenJti !== 'string' ||
      !Number.isInteger(payload.sessionVersion) ||
      !['hls', 'original', 'download'].includes(payload.kind) ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now() ||
      (payload.sessionId !== undefined && typeof payload.sessionId !== 'string')
    )
      throw new UnauthorizedException('媒体播放凭证已失效');
    return payload;
  }

  private async authorize(ticket: StreamTicket) {
    const [version, [blacklisted, revoked]] = await Promise.all([
      this.users.getSessionVersion(ticket.userId),
      this.redis.getMany([
        RedisKey.blacklist(ticket.tokenJti),
        ...(ticket.sessionId
          ? [RedisKey.sessionRevoked(ticket.userId, ticket.sessionId)]
          : []),
      ]),
    ]);
    if (
      version === null ||
      version !== ticket.sessionVersion ||
      blacklisted ||
      revoked
    )
      throw new UnauthorizedException('登录状态已失效，请重新打开媒体');
    const user = await this.users.getAuthUser(ticket.userId, version);
    if (!user)
      throw new UnauthorizedException('登录状态已失效，请重新打开媒体');
    if (
      user.roleCode !== RoleCode.ADMIN &&
      !user.permissions.includes(PermissionCode.ASSET_DOWNLOAD)
    )
      throw new ForbiddenException('无权读取媒体文件');
  }

  private async findOwned(assetId: string, userId: string) {
    const asset = await this.prisma.fileNode.findFirst({
      where: { ...assetWhere(userId), id: assetId },
      select: assetMediaSelect,
    });
    if (!asset) throw new NotFoundException('媒体文件不存在');
    return asset;
  }

  private async ensureHls(asset: MediaAsset) {
    if (asset.mediaType !== 'VIDEO')
      throw new BadRequestException('HLS 播放仅用于视频');
    if (
      asset.hlsKey &&
      asset.hlsSegmentCount > 0 &&
      (await this.storage.exists(asset.hlsKey))
    )
      return;
    if (asset.processingStatus === 'FAILED')
      throw new UnprocessableEntityException({
        code: 'ASSET_PROCESSING_FAILED',
        message: asset.processingError ?? '视频处理失败，请在任务页重试',
      });
    if (asset.processingStatus === 'READY') {
      await this.prisma.fileNode.updateMany({
        where: {
          id: asset.id,
          ownerId: asset.ownerId,
          deleted: false,
          processingStatus: 'READY',
          hlsKey: asset.hlsKey,
        },
        data: {
          processingStatus: 'PENDING',
          processingError: null,
          processingAttempts: 0,
          processingToken: null,
          processingLeaseUntil: null,
          processingNextAttemptAt: null,
        },
      });
    }
    await this.jobs.enqueue(asset.id, asset.ownerId);
    throw new HttpException(
      {
        code: 'MEDIA_PENDING',
        message: '后台正在生成 HLS 视频流，可先播放或下载原文件',
        details: { assetId: asset.id },
      },
      HttpStatus.ACCEPTED,
    );
  }

  private async playlist(asset: MediaAsset, ticket: string) {
    const opened = await this.storage.read(asset.hlsKey);
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      if (opened.stat.size > BigInt(HLS_MAX_PLAYLIST_BYTES))
        throw new InternalServerErrorException('HLS 播放列表过大');
      for await (const chunk of opened.stream) {
        size += chunk.length;
        if (size > HLS_MAX_PLAYLIST_BYTES)
          throw new InternalServerErrorException('HLS 播放列表过大');
        chunks.push(chunk);
      }
    } finally {
      opened.stream.destroy();
    }
    const playlist = Buffer.concat(chunks, size).toString('utf8');
    let segmentCount = 0;
    const lines = playlist.split(/\r?\n/).map((line) => {
      if (!line || line.startsWith('#')) return line;
      if (
        segmentCount >= asset.hlsSegmentCount ||
        line !== hlsSegmentName(segmentCount)
      )
        throw new InternalServerErrorException('HLS 分段索引无效');
      segmentCount += 1;
      return `${line}?ticket=${encodeURIComponent(ticket)}`;
    });
    if (
      segmentCount !== asset.hlsSegmentCount ||
      !playlist.includes('#EXT-X-ENDLIST')
    )
      throw new InternalServerErrorException('HLS 播放列表不完整');
    return lines.join('\n');
  }
}
