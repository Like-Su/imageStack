import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withSerializable } from '../../common/prisma/transaction';
import type { Prisma } from '../../prisma/generated/prisma/client';
import {
  assetWhere,
  mediaAssetWhere,
  readableAssetWhere,
  requireOwnedAssets,
} from './asset-scope';
import { albumWhere, requireAlbumAccess } from '../collections/album-scope';
import { buildAssetFilters } from './asset-filters';
import { ListAssetsDto } from './dto/assets-query.dto';
import { decodeAssetCursor, encodeAssetCursor } from './assets.cursor';
import { ThumbnailsService } from './thumbnails.service';
import {
  assetMediaSelect,
  thumbnailRevision,
  thumbnailRevisionSelect,
  type MediaAsset,
} from './asset-media';

const trashIdsCursorScope = createHash('sha256')
  .update('trash-ids:v1')
  .digest('base64url');

function listSelect(userId: string) {
  return {
    ...thumbnailRevisionSelect,
    id: true,
    ownerId: true,
    name: true,
    mediaType: true,
    processingStatus: true,
    processingError: true,
    processingAttempts: true,
    processingNextAttemptAt: true,
    updatedAt: true,
    size: true,
    mimeType: true,
    width: true,
    height: true,
    durationMs: true,
    takenAt: true,
    isFavorite: true,
    deleted: true,
    deletedAt: true,
    createdAt: true,
    tags: {
      where: { tag: { ownerId: userId } },
      select: { tag: { select: { id: true, name: true } } },
      orderBy: { tag: { name: 'asc' } },
    },
  } satisfies Prisma.FileNodeSelect;
}

type AssetListRow = Prisma.FileNodeGetPayload<{
  select: ReturnType<typeof listSelect>;
}>;

interface AssetPageOptions {
  deleted: boolean;
  keywords?: readonly string[];
  cursorScope?: string;
}

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

  list(userId: string, query: ListAssetsDto, deleted = false) {
    return this.findPage(userId, query, { deleted });
  }

  async trashIds(userId: string, after?: string) {
    const cursor = after
      ? decodeAssetCursor(after, userId, trashIdsCursorScope)
      : null;
    const rows = await this.prisma.fileNode.findMany({
      where: {
        ...assetWhere(userId, true),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: { id: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 1001,
    });
    const page = rows.slice(0, 1000);
    const last = page[page.length - 1];
    const hasMore = rows.length > 1000;
    return {
      items: page.map(({ id }) => ({ id })),
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeAssetCursor(last, userId, trashIdsCursorScope)
          : null,
    };
  }

  search(
    userId: string,
    query: ListAssetsDto,
    keywords: readonly string[],
    cursorScope: string,
  ) {
    return this.findPage(userId, query, {
      deleted: false,
      keywords,
      cursorScope,
    });
  }

  private async findPage(
    userId: string,
    query: ListAssetsDto,
    options: AssetPageOptions,
  ) {
    const cursor = query.cursor
      ? decodeAssetCursor(query.cursor, userId, options.cursorScope)
      : null;

    const where: Prisma.FileNodeWhereInput = {
      AND: [
        query.albumId && !options.deleted
          ? mediaAssetWhere()
          : assetWhere(userId, options.deleted),
        buildAssetFilters(userId, query, options.keywords),
        ...(cursor
          ? [
              {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
      ],
    };

    const rows = await this.prisma.fileNode.findMany({
      where,
      select: listSelect(userId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];

    return {
      items: page.map((row) => this.summary(row, userId)),
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeAssetCursor(last, userId, options.cursorScope)
          : null,
    };
  }

  async detail(assetId: string, userId: string, deleted = false) {
    const asset = await this.prisma.fileNode.findFirst({
      where: {
        ...(deleted ? assetWhere(userId, true) : readableAssetWhere(userId)),
        id: assetId,
      },
      select: {
        ...listSelect(userId),
        hashAlgorithm: true,
        hash: true,
        durationMs: true,
        exif: true,
        updatedAt: true,
        albums: {
          where: { album: albumWhere(userId) },
          select: { album: { select: { id: true, name: true } } },
          orderBy: { album: { name: 'asc' } },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('资产不存在');
    }

    return {
      ...this.summary(asset, userId),
      hashAlgorithm: asset.hashAlgorithm,
      hash: asset.hash,
      durationMs: asset.durationMs?.toString() ?? null,
      exif: asset.exif ?? null,
      albums: asset.albums.map(({ album }) => album),
      updatedAt: asset.updatedAt.toISOString(),
      fileUrl: deleted
        ? null
        : `${this.apiPrefix}/assets/${encodeURIComponent(asset.id)}/file`,
      previewUrl:
        !deleted && asset.mediaType === 'VIDEO'
          ? `${this.apiPrefix}/assets/${encodeURIComponent(asset.id)}/preview`
          : null,
    };
  }

  rename(assetId: string, userId: string, name: string, albumId?: string) {
    return withSerializable(this.prisma, async (transaction) => {
      if (albumId)
        await requireAlbumAccess(transaction, albumId, userId, 'edit');
      const where: Prisma.FileNodeWhereInput = albumId
        ? { ...mediaAssetWhere(), id: assetId, albums: { some: { albumId } } }
        : { ...assetWhere(userId), id: assetId };
      const asset = await transaction.fileNode.findFirst({
        where,
        select: { name: true, updatedAt: true },
      });

      if (!asset) {
        throw new NotFoundException('资产不存在');
      }

      const extension = asset.name.match(/\.[^.]+$/u)?.[0] ?? '';
      const nextExtension = name.match(/\.[^.]+$/u)?.[0] ?? '';
      if (extension.toLowerCase() !== nextExtension.toLowerCase()) {
        throw new BadRequestException('重命名不能更改文件扩展名');
      }
      const baseName = extension ? name.slice(0, -extension.length) : name;
      if (!baseName.trim() || baseName === '.' || baseName === '..') {
        throw new BadRequestException('请输入有效的文件名称');
      }

      if (name === asset.name) {
        return { id: assetId, name, updatedAt: asset.updatedAt.toISOString() };
      }

      const updatedAt = new Date();
      const result = await transaction.fileNode.updateMany({
        where: { ...where, name: asset.name },
        data: { name, updatedAt },
      });

      if (result.count !== 1) {
        throw new ConflictException('文件状态或名称已变化，请刷新后重试');
      }

      return { id: assetId, name, updatedAt: updatedAt.toISOString() };
    });
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
    const asset = await this.findReadable(assetId, userId);
    return this.originalResource(asset);
  }

  private originalResource(asset: MediaAsset) {
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

    const asset = deleted
      ? await this.findOwned(assetId, userId, true)
      : await this.findReadable(assetId, userId);
    return this.thumbnails.get(asset);
  }

  async preview(assetId: string, userId: string) {
    const asset = await this.findReadable(assetId, userId);
    if (asset.mediaType !== 'VIDEO')
      throw new BadRequestException('兼容预览仅用于视频');
    return this.thumbnails.get(asset, 'preview');
  }

  async sharedMedia(
    assetId: string,
    userId: string,
    scope: Prisma.FileNodeWhereInput,
    original: boolean,
  ) {
    const asset = await this.findOwned(assetId, userId, false, scope);
    return original ? this.originalResource(asset) : this.thumbnails.get(asset);
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

  private async findOwned(
    assetId: string,
    userId: string,
    deleted = false,
    scope?: Prisma.FileNodeWhereInput,
  ) {
    const asset = await this.prisma.fileNode.findFirst({
      where: {
        ...assetWhere(userId, deleted),
        id: assetId,
        ...(scope ? { AND: [scope] } : {}),
      },
      select: assetMediaSelect,
    });

    if (!asset) {
      throw new NotFoundException('资产不存在');
    }

    return asset;
  }

  private async findReadable(assetId: string, userId: string) {
    const asset = await this.prisma.fileNode.findFirst({
      where: { ...readableAssetWhere(userId), id: assetId },
      select: assetMediaSelect,
    });
    if (!asset) throw new NotFoundException('资产不存在或没有查看权限');
    return asset;
  }

  private summary(asset: AssetListRow, userId: string) {
    return {
      id: asset.id,
      ownerId: asset.ownerId,
      name: asset.name,
      type: asset.mediaType,
      status: asset.processingStatus ?? 'PENDING',
      processingError: asset.processingError,
      processingAttempts: asset.processingAttempts,
      nextAttemptAt: asset.processingNextAttemptAt?.toISOString() ?? null,
      updatedAt: asset.updatedAt.toISOString(),
      size: asset.size?.toString() ?? null,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      durationMs: asset.durationMs?.toString() ?? null,
      takenAt: asset.takenAt?.toISOString() ?? null,
      isFavorite: asset.ownerId === userId && asset.isFavorite,
      deleted: asset.deleted,
      deletedAt: asset.deletedAt?.toISOString() ?? null,
      createdAt: asset.createdAt.toISOString(),
      tags: (asset.ownerId === userId ? asset.tags : []).map(({ tag }) => ({
        ...tag,
        source: 'MANUAL' as const,
      })),
      thumbUrl: this.thumbnailUrl(asset.id, asset.deleted),
      thumbnailRevision: thumbnailRevision(asset),
    };
  }
}
