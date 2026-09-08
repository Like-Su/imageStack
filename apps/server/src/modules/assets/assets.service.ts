import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withSerializable } from '../../common/prisma/transaction';
import type { Prisma } from '../../prisma/generated/prisma/client';
import { assetWhere, requireOwnedAssets } from './asset-scope';
import { ListAssetsDto } from './dto/assets-query.dto';
import { decodeAssetCursor, encodeAssetCursor } from './assets.cursor';
import { ThumbnailsService } from './thumbnails.service';

const listSelect = {
  id: true,
  name: true,
  mediaType: true,
  processingStatus: true,
  processingError: true,
  size: true,
  mimeType: true,
  width: true,
  height: true,
  takenAt: true,
  isFavorite: true,
  deleted: true,
  deletedAt: true,
  createdAt: true,
  tags: {
    select: { tag: { select: { id: true, name: true } } },
    orderBy: { tag: { name: 'asc' } },
  },
} satisfies Prisma.FileNodeSelect;

type AssetListRow = Prisma.FileNodeGetPayload<{
  select: typeof listSelect;
}>;

@Injectable()
export class AssetsService {
  private readonly apiPrefix: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly thumbnails: ThumbnailsService,
    config: ConfigService,
  ) {
    const prefix = config
      .getOrThrow<string>('API_PREFIX')
      .replace(/^\/+|\/+$/g, '');

    this.apiPrefix = prefix ? `/${prefix}` : '';
  }

  async list(userId: string, query: ListAssetsDto, deleted = false) {
    const cursor = query.cursor
      ? decodeAssetCursor(query.cursor, userId)
      : null;

    const where: Prisma.FileNodeWhereInput = {
      ...assetWhere(userId, deleted),
      ...(query.favorite !== undefined ? { isFavorite: query.favorite } : {}),
      ...(query.albumId
        ? {
            albums: {
              some: { album: { id: query.albumId, ownerId: userId } },
            },
          }
        : {}),
      ...(query.tagId || query.tag
        ? {
            tags: {
              some: {
                tag: {
                  ownerId: userId,
                  ...(query.tagId ? { id: query.tagId } : {}),
                  ...(query.tag ? { name: query.tag } : {}),
                },
              },
            },
          }
        : {}),
      ...(cursor
        ? {
            OR: [
              {
                createdAt: {
                  lt: cursor.createdAt,
                },
              },
              {
                createdAt: cursor.createdAt,
                id: {
                  lt: cursor.id,
                },
              },
            ],
          }
        : {}),
    };

    if (query.status === 'PENDING') {
      where.AND = [
        { OR: [{ processingStatus: 'PENDING' }, { processingStatus: null }] },
      ];
    } else if (query.status) {
      where.processingStatus = query.status;
    }

    const rows = await this.prisma.fileNode.findMany({
      where,
      select: listSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];

    return {
      items: page.map((row) => this.summary(row)),
      hasMore,
      nextCursor: hasMore && last ? encodeAssetCursor(last, userId) : null,
    };
  }

  async detail(assetId: string, userId: string) {
    const asset = await this.prisma.fileNode.findFirst({
      where: { ...assetWhere(userId), id: assetId },
      select: {
        ...listSelect,
        hashAlgorithm: true,
        hash: true,
        durationMs: true,
        exif: true,
        updatedAt: true,
        albums: {
          select: { album: { select: { id: true, name: true } } },
          orderBy: { album: { name: 'asc' } },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('资产不存在');
    }

    return {
      ...this.summary(asset),
      hashAlgorithm: asset.hashAlgorithm,
      hash: asset.hash,
      durationMs: asset.durationMs?.toString() ?? null,
      exif: asset.exif ?? null,
      albums: asset.albums.map(({ album }) => album),
      updatedAt: asset.updatedAt.toISOString(),
      fileUrl: `${this.apiPrefix}/assets/${encodeURIComponent(asset.id)}/file`,
    };
  }

  async setFavorite(assetId: string, userId: string, isFavorite: boolean) {
    const result = await this.prisma.fileNode.updateMany({
      where: { ...assetWhere(userId), id: assetId },
      data: { isFavorite },
    });

    if (result.count !== 1) {
      throw new NotFoundException('资产不存在');
    }

    return { id: assetId, isFavorite };
  }

  moveToTrash(userId: string, ids: string[]) {
    return this.setDeleted(userId, ids, true);
  }

  restore(userId: string, ids: string[]) {
    return this.setDeleted(userId, ids, false);
  }

  async original(assetId: string, userId: string) {
    const asset = await this.findOwned(assetId, userId);

    if (!asset.storageKey || !asset.mimeType) {
      throw new InternalServerErrorException('资产存储信息不完整');
    }

    return {
      key: asset.storageKey,
      mimeType: asset.mimeType,
    };
  }

  async thumbnail(
    assetId: string,
    userId: string,
    size: string,
    deleted = false,
  ) {
    if (size !== 'sm') {
      throw new BadRequestException('当前只支持 sm 缩略图');
    }

    const asset = await this.findOwned(assetId, userId, deleted);
    return this.thumbnails.get(asset);
  }

  thumbnailUrl(assetId: string, deleted = false) {
    const path = deleted ? 'assets/trash' : 'assets';
    return `${this.apiPrefix}/${path}/${encodeURIComponent(assetId)}/thumbnail?size=sm`;
  }

  private setDeleted(userId: string, ids: string[], deleted: boolean) {
    return withSerializable(this.prisma, async (transaction) => {
      await requireOwnedAssets(transaction, userId, ids, null);

      return transaction.fileNode.updateMany({
        where: { ...assetWhere(userId, !deleted), id: { in: ids } },
        data: { deleted, deletedAt: deleted ? new Date() : null },
      });
    });
  }

  private async findOwned(assetId: string, userId: string, deleted = false) {
    const asset = await this.prisma.fileNode.findFirst({
      where: {
        ...assetWhere(userId, deleted),
        id: assetId,
      },
    });

    if (!asset) {
      throw new NotFoundException('资产不存在');
    }

    return asset;
  }

  private summary(asset: AssetListRow) {
    return {
      id: asset.id,
      name: asset.name,
      type: asset.mediaType,
      status: asset.processingStatus ?? 'PENDING',
      processingError: asset.processingError,
      size: asset.size?.toString() ?? null,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      takenAt: asset.takenAt?.toISOString() ?? null,
      isFavorite: asset.isFavorite,
      deleted: asset.deleted,
      deletedAt: asset.deletedAt?.toISOString() ?? null,
      createdAt: asset.createdAt.toISOString(),
      tags: asset.tags.map(({ tag }) => ({
        ...tag,
        source: 'MANUAL' as const,
      })),
      thumbUrl: this.thumbnailUrl(asset.id, asset.deleted),
    };
  }
}
