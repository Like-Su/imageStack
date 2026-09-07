import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Prisma } from '../../prisma/generated/prisma/client';
import { ListAssetsDto } from './dto/assets-query.dto';
import { decodeAssetCursor, encodeAssetCursor } from './assets.cursor';
import { ThumbnailsService } from './thumbnails.service';

const listSelect = {
  id: true,
  name: true,
  mediaType: true,
  processingStatus: true,
  size: true,
  mimeType: true,
  width: true,
  height: true,
  takenAt: true,
  isFavorite: true,
  createdAt: true,
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

  async list(userId: string, query: ListAssetsDto) {
    const cursor = query.cursor
      ? decodeAssetCursor(query.cursor, userId)
      : null;

    const where: Prisma.FileNodeWhereInput = {
      ...this.visibleWhere(userId),
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
    const asset = await this.findOwned(assetId, userId);

    return {
      ...this.summary(asset),
      hashAlgorithm: asset.hashAlgorithm,
      hash: asset.hash,
      durationMs: asset.durationMs?.toString() ?? null,
      exif: asset.exif ?? null,
      updatedAt: asset.updatedAt.toISOString(),
      fileUrl: `${this.apiPrefix}/assets/${encodeURIComponent(asset.id)}/file`,
    };
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

  async thumbnail(assetId: string, userId: string, size: string) {
    if (size !== 'sm') {
      throw new BadRequestException('当前只支持 sm 缩略图');
    }

    const asset = await this.findOwned(assetId, userId);
    const key = await this.thumbnails.getOrCreate(asset);

    return {
      key,
      mimeType: 'image/webp',
    };
  }

  private visibleWhere(userId: string): Prisma.FileNodeWhereInput {
    return {
      ownerId: userId,
      deleted: false,
      type: 'FILE',
      mediaType: 'IMAGE',
      storageProvider: 'LOCAL_FS',
      storageKey: {
        not: null,
      },
      mimeType: {
        in: ['image/jpeg', 'image/png', 'image/webp'],
      },
    };
  }

  private async findOwned(assetId: string, userId: string) {
    const asset = await this.prisma.fileNode.findFirst({
      where: {
        ...this.visibleWhere(userId),
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
      size: asset.size?.toString() ?? null,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      takenAt: asset.takenAt?.toISOString() ?? null,
      isFavorite: asset.isFavorite,
      createdAt: asset.createdAt.toISOString(),
      thumbUrl:
        `${this.apiPrefix}/assets/` +
        `${encodeURIComponent(asset.id)}/thumbnail?size=sm`,
    };
  }
}
