import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withSerializable } from '../../common/prisma/transaction';
import { MediaJobsService } from '../jobs/media-jobs.service';
import { STORAGE_PROVIDER } from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';
import { assetWhere, requireOwnedAssets } from './asset-scope';
import { IMAGE_MIME_TYPES } from '../../common/media-formats';
import { Prisma } from '../../prisma/generated/prisma/client';
import { hlsObjectKeys } from '../../common/video-stream';

interface PlaceRow {
  latitudeCell: number;
  longitudeCell: number;
  count: bigint;
  locatedCount: bigint;
  groupCount: bigint;
}

@Injectable()
export class AssetWorkspaceService {
  private readonly logger = new Logger(AssetWorkspaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: MediaJobsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async overview(userId: string) {
    const groupByData = this.prisma.fileNode.groupBy({
      by: ['deleted', 'processingStatus'],
      where: assetWhere(userId, null),
      _count: { _all: true },
      _sum: { size: true },
    });

    const [groups, favorites, albums, tags] = await this.prisma.$transaction([
      groupByData,
      this.prisma.fileNode.count({
        where: { ...assetWhere(userId), isFavorite: true },
      }),
      this.prisma.album.count({ where: { ownerId: userId } }),
      this.prisma.tag.count({ where: { ownerId: userId } }),
    ]);
    const statuses = { PENDING: 0, PROCESSING: 0, READY: 0, FAILED: 0 };
    let total = 0;
    let trash = 0;
    let bytes = 0n;
    let trashBytes = 0n;
    for (const group of groups) {
      if (group.deleted) {
        trash += group._count._all;
        trashBytes += group._sum.size ?? 0n;
      } else {
        total += group._count._all;
        bytes += group._sum.size ?? 0n;
        statuses[group.processingStatus ?? 'PENDING'] += group._count._all;
      }
    }
    return {
      total,
      favorites,
      albums,
      tags,
      trash,
      bytes: bytes.toString(),
      trashBytes: trashBytes.toString(),
      statuses,
    };
  }

  async places(userId: string) {
    const rows = await this.prisma.$queryRaw<PlaceRow[]>`
      WITH positions AS (
        SELECT
          CASE WHEN jsonb_typeof("exif"->'latitude') = 'number'
            THEN ("exif"->>'latitude')::numeric END AS latitude,
          CASE WHEN jsonb_typeof("exif"->'longitude') = 'number'
            THEN ("exif"->>'longitude')::numeric END AS longitude
        FROM "FileNode"
        WHERE "ownerId" = ${userId} AND "deleted" = false
          AND "type" = 'FILE' AND "mediaType" = 'IMAGE'
          AND "storageProvider" = 'LOCAL_FS' AND "storageKey" IS NOT NULL
          AND "mimeType" IN (${Prisma.join(IMAGE_MIME_TYPES)})
      )
      SELECT floor(latitude * 10)::int AS "latitudeCell",
        floor(longitude * 10)::int AS "longitudeCell", count(*) AS count,
        sum(count(*)) OVER ()::bigint AS "locatedCount",
        count(*) OVER () AS "groupCount"
      FROM positions
      WHERE latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
      GROUP BY floor(latitude * 10), floor(longitude * 10)
      ORDER BY count(*) DESC, floor(latitude * 10), floor(longitude * 10)
      LIMIT 500
    `;
    return {
      locatedAssets: Number(rows[0]?.locatedCount ?? 0),
      totalPlaces: Number(rows[0]?.groupCount ?? 0),
      items: rows.map((row) => ({
        id: `${row.latitudeCell}:${row.longitudeCell}`,
        latitude: Math.min(90, (row.latitudeCell + 0.5) / 10),
        longitude: Math.min(180, (row.longitudeCell + 0.5) / 10),
        count: Number(row.count),
      })),
    };
  }

  async retry(assetId: string, userId: string) {
    const result = await this.prisma.fileNode.updateMany({
      where: { ...assetWhere(userId), id: assetId, processingStatus: 'FAILED' },
      data: {
        processingStatus: 'PENDING',
        processingError: null,
        processingAttempts: 0,
        processingToken: null,
        processingLeaseUntil: null,
        processingNextAttemptAt: null,
      },
    });
    if (result.count !== 1) {
      throw new ConflictException('仅能重试自己的未删除失败任务，请刷新列表');
    }
    const enqueued = await this.jobs.enqueue(assetId, userId);
    return { id: assetId, status: 'PENDING' as const, enqueued };
  }

  async purge(userId: string, ids: string[]) {
    const removed = await withSerializable(this.prisma, async (transaction) => {
      await requireOwnedAssets(transaction, userId, ids, true);
      const files = await transaction.fileNode.findMany({
        where: { ...assetWhere(userId, true), id: { in: ids } },
        select: {
          storageKey: true,
          thumbnailKey: true,
          previewKey: true,
          hlsKey: true,
          hlsSegmentCount: true,
        },
      });
      await transaction.fileShare.deleteMany({
        where: { fileId: { in: ids } },
      });
      await transaction.filePermission.deleteMany({
        where: { fileId: { in: ids } },
      });
      await transaction.fileNode.deleteMany({
        where: { ...assetWhere(userId, true), id: { in: ids } },
      });
      return files;
    });
    const keys = new Set(
      removed.flatMap((file) =>
        [
          file.storageKey,
          file.thumbnailKey,
          file.previewKey,
          file.hlsKey,
        ].filter((key): key is string => Boolean(key)),
      ),
    );
    const hlsCounts = new Map(
      removed
        .filter((file) => file.hlsKey)
        .map((file) => [file.hlsKey, file.hlsSegmentCount]),
    );
    let cleanupPending = 0;
    for (const key of keys) {
      try {
        const references = await this.prisma.fileNode.count({
          where: {
            OR: [
              { storageKey: key },
              { thumbnailKey: key },
              { previewKey: key },
              { hlsKey: key },
            ],
          },
        });
        const uploads = await this.prisma.uploadSession.count({
          where: { storageKey: key, status: { in: ['PENDING', 'UPLOADING'] } },
        });
        if (references === 0 && uploads === 0) {
          const objects = hlsCounts.has(key)
            ? hlsObjectKeys(key, hlsCounts.get(key))
            : [key];
          for (let offset = 0; offset < objects.length; offset += 16)
            await Promise.all(
              objects
                .slice(offset, offset + 16)
                .map((objectKey) => this.storage.delete(objectKey)),
            );
        }
      } catch (error) {
        cleanupPending += 1;
        this.logger.error(
          `回收站记录已删除，存储对象待管理员清理：${key}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return { count: removed.length, cleanupPending };
  }
}
