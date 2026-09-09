import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withSerializable } from '../../common/prisma/transaction';
import type { Prisma } from '../../prisma/generated/prisma/client';
import { assetWhere, requireOwnedAssets } from '../assets/asset-scope';
import { AssetsService } from '../assets/assets.service';
import { rethrowCollectionError } from './collection-errors';
import { CreateAlbumDto, UpdateAlbumDto } from './dto/collections.dto';

function albumInclude(userId: string) {
  return {
    coverAsset: {
      where: assetWhere(userId),
      select: { id: true },
    },
    assets: {
      where: { asset: assetWhere(userId) },
      select: { assetId: true },
      orderBy: [{ asset: { createdAt: 'desc' } }, { assetId: 'desc' }],
      take: 1,
    },
    _count: {
      select: { assets: { where: { asset: assetWhere(userId) } } },
    },
  } satisfies Prisma.AlbumInclude;
}

type AlbumRow = Prisma.AlbumGetPayload<{
  include: ReturnType<typeof albumInclude>;
}>;

@Injectable()
export class AlbumsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async list(userId: string) {
    const albums = await this.prisma.album.findMany({
      where: { ownerId: userId },
      include: albumInclude(userId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return albums.map((album) => this.summary(album));
  }

  async detail(albumId: string, userId: string, query: CursorPaginationDto) {
    const album = await this.prisma.album.findFirst({
      where: { id: albumId, ownerId: userId },
      include: albumInclude(userId),
    });

    if (!album) {
      throw new NotFoundException('相册不存在');
    }

    return {
      ...this.summary(album),
      assets: await this.assets.list(userId, { ...query, albumId }),
    };
  }

  async create(userId: string, body: CreateAlbumDto) {
    const album = await this.prisma.album
      .create({
        data: {
          ownerId: userId,
          name: body.name,
          description: body.description,
        },
        include: albumInclude(userId),
      })
      .catch((error: unknown) => rethrowCollectionError(error, '相册'));

    return this.summary(album);
  }

  update(albumId: string, userId: string, body: UpdateAlbumDto) {
    if (
      body.name === undefined &&
      body.description === undefined &&
      body.coverAssetId === undefined
    ) {
      throw new BadRequestException('至少提供一个要更新的相册字段');
    }

    return withSerializable(this.prisma, async (transaction) => {
      await this.requireOwned(transaction, albumId, userId);

      if (body.coverAssetId !== undefined && body.coverAssetId !== null) {
        await requireOwnedAssets(transaction, userId, [body.coverAssetId]);

        const member = await transaction.albumAsset.findUnique({
          where: {
            albumId_assetId: { albumId, assetId: body.coverAssetId },
          },
          select: { assetId: true },
        });

        if (!member) {
          throw new BadRequestException('封面必须是相册中的未删除资产');
        }
      }

      const album = await transaction.album.update({
        where: { id: albumId, ownerId: userId },
        data: {
          name: body.name,
          description: body.description,
          coverAssetId: body.coverAssetId,
        },
        include: albumInclude(userId),
      });

      return this.summary(album);
    }).catch((error: unknown) => rethrowCollectionError(error, '相册'));
  }

  remove(albumId: string, userId: string) {
    return withSerializable(this.prisma, async (transaction) => {
      await this.requireOwned(transaction, albumId, userId);

      return transaction.album.delete({
        where: { id: albumId, ownerId: userId },
        select: { id: true },
      });
    }).catch((error: unknown) => rethrowCollectionError(error, '相册'));
  }

  addAssets(albumId: string, userId: string, ids: string[]) {
    return withSerializable(this.prisma, async (transaction) => {
      await this.requireOwned(transaction, albumId, userId);
      await requireOwnedAssets(transaction, userId, ids);

      const result = await transaction.albumAsset.createMany({
        data: ids.map((assetId) => ({ albumId, assetId })),
        skipDuplicates: true,
      });

      if (result.count > 0) {
        await transaction.album.update({
          where: { id: albumId, ownerId: userId },
          data: { updatedAt: new Date() },
        });
      }

      return result;
    });
  }

  removeAssets(albumId: string, userId: string, ids: string[]) {
    return withSerializable(this.prisma, async (transaction) => {
      const album = await this.requireOwned(transaction, albumId, userId);
      await requireOwnedAssets(transaction, userId, ids, null);

      const result = await transaction.albumAsset.deleteMany({
        where: { albumId, assetId: { in: ids } },
      });

      if (result.count > 0) {
        await transaction.album.update({
          where: { id: albumId, ownerId: userId },
          data: {
            updatedAt: new Date(),
            ...(ids.includes(album.coverAssetId) ? { coverAssetId: null } : {}),
          },
        });
      }

      return result;
    });
  }

  private async requireOwned(
    transaction: Prisma.TransactionClient,
    albumId: string,
    userId: string,
  ) {
    const album = await transaction.album.findFirst({
      where: { id: albumId, ownerId: userId },
      select: { id: true, coverAssetId: true },
    });

    if (!album) {
      throw new NotFoundException('相册不存在');
    }

    return album;
  }

  private summary(album: AlbumRow) {
    const coverAssetId =
      album.coverAsset?.id ?? album.assets[0]?.assetId ?? null;

    return {
      id: album.id,
      name: album.name,
      description: album.description,
      coverAssetId,
      coverUrl: coverAssetId ? this.assets.thumbnailUrl(coverAssetId) : null,
      count: album._count.assets,
      createdAt: album.createdAt.toISOString(),
      updatedAt: album.updatedAt.toISOString(),
    };
  }
}
