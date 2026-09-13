import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withSerializable } from '../../common/prisma/transaction';
import { Prisma, ShareLink } from '../../prisma/generated/prisma/client';
import type { RequestUser } from '../iam/auth/auth.type';
import { AssetsService } from '../assets/assets.service';
import { CreateShareDto, SharePageDto, ShareTargetDto } from './dto/shares.dto';
import {
  MAX_SHARED_IMAGES,
  sharedImagesWhere,
  shareOwnerWhere,
  shareUnavailable,
} from './shares.scope';

const publicAssetSelect = {
  id: true,
  name: true,
  width: true,
  height: true,
  size: true,
  mimeType: true,
} satisfies Prisma.FileNodeSelect;

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  private target(target: ShareTargetDto) {
    return target.kind === 'asset'
      ? { assetId: target.targetId, albumId: null }
      : { assetId: null, albumId: target.targetId };
  }

  private summary(share: ShareLink) {
    return {
      id: share.id,
      path: `/s/${share.token}`,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
      createdAt: share.createdAt,
    };
  }

  private async requireUser(
    transaction: Prisma.TransactionClient,
    user: RequestUser,
    sharing = false,
  ) {
    const account = await transaction.user.findFirst({
      where: {
        ...(sharing
          ? shareOwnerWhere()
          : { deleted: false, status: 'ACTIVE' as const, role: { status: 1 } }),
        id: user.id,
        sessionVersion: user.sessionVersion,
      },
      select: { id: true },
    });
    if (!account) throw new UnauthorizedException('账户状态已变化，请重新登录');
  }

  async create(user: RequestUser, body: CreateShareDto) {
    return withSerializable(this.prisma, async (transaction) => {
      await this.requireUser(transaction, user, true);
      const target = this.target(body);
      if (
        target.albumId &&
        !(await transaction.album.findFirst({
          where: { id: target.albumId, ownerId: user.id },
          select: { id: true },
        }))
      )
        throw new NotFoundException('相册不存在');
      const count = await transaction.fileNode.count({
        where: sharedImagesWhere({ ownerId: user.id, ...target }),
      });
      if (!count) throw new BadRequestException('没有可分享的图片');
      if (count > MAX_SHARED_IMAGES)
        throw new BadRequestException('一次最多分享 500 张图片，请拆分相册');
      const share = await transaction.shareLink.create({
        data: {
          ownerId: user.id,
          ...target,
          token: randomBytes(16).toString('base64url'),
          expiresAt: body.expiresInDays
            ? new Date(Date.now() + body.expiresInDays * 86_400_000)
            : null,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: 'share.create',
          entityType: 'ShareLink',
          entityId: share.id,
          afterJson: {
            kind: body.kind,
            targetId: body.targetId,
            expiresInDays: body.expiresInDays,
          },
        },
      });
      return this.summary(share);
    });
  }

  async list(userId: string, query: ShareTargetDto) {
    const shares = await this.prisma.shareLink.findMany({
      where: { ownerId: userId, ...this.target(query) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return shares.map((share) => this.summary(share));
  }

  async revoke(user: RequestUser, id: string) {
    return withSerializable(this.prisma, async (transaction) => {
      await this.requireUser(transaction, user);
      const updated = await transaction.shareLink.updateMany({
        where: { id, ownerId: user.id },
        data: { revokedAt: new Date() },
      });
      if (!updated.count) throw new NotFoundException('分享不存在');
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: 'share.revoke',
          entityType: 'ShareLink',
          entityId: id,
        },
      });
      return { id };
    });
  }

  private async resolve(transaction: Prisma.TransactionClient, token: string) {
    const share = await transaction.shareLink.findFirst({
      where: {
        token,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        owner: shareOwnerWhere(),
      },
      include: {
        album: {
          select: {
            ownerId: true,
            name: true,
            description: true,
            coverAssetId: true,
          },
        },
      },
    });
    if (
      !share ||
      (!share.assetId &&
        (!share.album || share.album.ownerId !== share.ownerId))
    )
      shareUnavailable();
    return share;
  }

  async detail(token: string, query: SharePageDto) {
    const share = await this.resolve(this.prisma, token);
    const where = sharedImagesWhere(share);
    const [rows, total] = await Promise.all([
      this.prisma.fileNode.findMany({
        where: {
          ...where,
          ...(query.cursor ? { AND: [{ id: { gt: query.cursor } }] } : {}),
        },
        select: publicAssetSelect,
        orderBy: { id: 'asc' },
        take: query.limit + 1,
      }),
      this.prisma.fileNode.count({ where }),
    ]);
    if (share.assetId && !total) shareUnavailable();
    const items = rows.slice(0, query.limit);
    return {
      kind: share.assetId ? 'asset' : 'album',
      title: share.album?.name ?? items[0]?.name ?? '',
      description: share.album?.description ?? null,
      total,
      expiresAt: share.expiresAt,
      items: items.map((asset) => ({
        ...asset,
        size: asset.size?.toString() ?? null,
      })),
      nextCursor:
        rows.length > query.limit
          ? (items[items.length - 1]?.id ?? null)
          : null,
    };
  }

  async media(token: string, assetId: string, original: boolean) {
    const share = await this.resolve(this.prisma, token);
    return this.assets.sharedMedia(
      assetId,
      share.ownerId,
      sharedImagesWhere(share),
      original,
    );
  }

  async save(user: RequestUser, token: string) {
    return withSerializable(this.prisma, async (transaction) => {
      await this.requireUser(transaction, user);
      const share = await this.resolve(transaction, token);
      const receiptKey = { shareId: share.id, userId: user.id };
      const previous = await transaction.shareSave.findUnique({
        where: { shareId_userId: receiptKey },
      });
      if (previous?.count || share.ownerId === user.id) {
        const count = await transaction.fileNode.count({
          where: sharedImagesWhere(share),
        });
        if (!count) shareUnavailable();
        if (count > MAX_SHARED_IMAGES)
          throw new BadRequestException(
            '一次最多保存 500 张图片，请联系分享者拆分相册',
          );
        return {
          alreadySaved: true,
          count: previous?.count || count,
          assetId: previous?.count ? previous.assetId : share.assetId,
          albumId: previous?.count ? previous.albumId : share.albumId,
        };
      }
      const sources = await transaction.fileNode.findMany({
        where: sharedImagesWhere(share),
        orderBy: { id: 'asc' },
        take: MAX_SHARED_IMAGES + 1,
      });
      if (!sources.length) shareUnavailable();
      if (sources.length > MAX_SHARED_IMAGES)
        throw new BadRequestException(
          '一次最多保存 500 张图片，请联系分享者拆分相册',
        );
      const receipt = await transaction.shareSave.upsert({
        where: { shareId_userId: receiptKey },
        create: receiptKey,
        update: { userId: user.id },
      });
      if (receipt.count)
        return {
          alreadySaved: true,
          count: receipt.count,
          assetId: receipt.assetId,
          albumId: receipt.albumId,
        };
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "FileNode" WHERE "id" IN (${Prisma.join(sources.map((asset) => asset.id))}) ORDER BY "id" FOR SHARE`,
      );
      const copies = sources.map((asset) => ({
        id: randomUUID(),
        ownerId: user.id,
        name: asset.name,
        type: 'FILE' as const,
        mediaType: 'IMAGE' as const,
        storageProvider: asset.storageProvider,
        storageBucket: asset.storageBucket,
        storageKey: asset.storageKey,
        size: asset.size,
        mimeType: asset.mimeType,
        hashAlgorithm: asset.hashAlgorithm,
        hash: asset.hash,
        width: asset.width,
        height: asset.height,
        takenAt: asset.takenAt,
        exif: asset.exif ?? Prisma.DbNull,
        thumbnailKey: asset.thumbnailKey,
        thumbnailVersion: asset.thumbnailVersion,
        processingStatus:
          asset.processingStatus === 'READY'
            ? ('READY' as const)
            : ('PENDING' as const),
      }));
      await transaction.fileNode.createMany({ data: copies });
      let albumId: string | null = null;
      if (share.album) {
        const coverIndex = sources.findIndex(
          (asset) => asset.id === share.album.coverAssetId,
        );
        const album = await transaction.album.create({
          data: {
            ownerId: user.id,
            name: `${share.album.name.slice(0, 170)} · 分享 ${randomBytes(6).toString('hex')}`,
            description: share.album.description,
            coverAssetId: copies[Math.max(0, coverIndex)].id,
            assets: {
              createMany: {
                data: copies.map((asset) => ({ assetId: asset.id })),
              },
            },
          },
          select: { id: true },
        });
        albumId = album.id;
      }
      const saved = await transaction.shareSave.update({
        where: { shareId_userId: receiptKey },
        data: {
          count: copies.length,
          assetId: share.assetId ? copies[0].id : null,
          albumId,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: 'share.save',
          entityType: 'ShareLink',
          entityId: share.id,
          afterJson: { count: copies.length },
        },
      });
      return {
        alreadySaved: false,
        count: saved.count,
        assetId: saved.assetId,
        albumId: saved.albumId,
      };
    });
  }
}
