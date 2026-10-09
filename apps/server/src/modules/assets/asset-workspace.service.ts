import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { withSerializable } from '../../infrastructure/prisma/transaction';
import { MediaJobsService } from '../jobs/media-jobs.service';
import { storageProviderTypes } from '../../infrastructure/storage/storage.provider';
import type { StorageLocation } from '../../infrastructure/storage/storage.provider';
import { StorageService } from '../../infrastructure/storage/storage.service';
import {
  assetWhere,
  requireOwnedAssets,
  visualAssetWhere,
} from './asset-scope';
import { albumWhere } from '../collections/album-scope';
import { IMAGE_MIME_TYPES } from '../../common/media-formats';
import { Prisma } from '../../infrastructure/prisma/generated/prisma/client';
import { hlsObjectKeys } from '../../common/video-stream';
import { referencedStorageKeys } from '../../infrastructure/storage/storage-references';
import { CoalescedReads } from '../../common/coalesced-reads';

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
  private readonly reads = new CoalescedReads();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: MediaJobsService,
    private readonly storage: StorageService,
  ) {}

  overview(userId: string) {
    return this.reads.run(`overview:${userId}`, () =>
      this.readOverview(userId),
    );
  }

  private async readOverview(userId: string) {
    const groupByData = this.prisma.fileNode.groupBy({
      by: ['deleted', 'processingStatus', 'isFavorite'],
      where: assetWhere(userId, null),
      _count: { _all: true },
      _sum: { size: true },
    });

    const [groups, albums, tags] = await this.prisma.$transaction([
      groupByData,
      this.prisma.album.count({ where: albumWhere(userId) }),
      this.prisma.tag.count({ where: { ownerId: userId } }),
    ]);
    const statuses = { PENDING: 0, PROCESSING: 0, READY: 0, FAILED: 0 };
    let total = 0;
    let favorites = 0;
    let trash = 0;
    let bytes = 0n;
    let trashBytes = 0n;
    for (const group of groups) {
      if (group.deleted) {
        trash += group._count._all;
        trashBytes += group._sum.size ?? 0n;
      } else {
        total += group._count._all;
        if (group.isFavorite) favorites += group._count._all;
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

  places(userId: string) {
    return this.reads.run(`places:${userId}`, () => this.readPlaces(userId));
  }

  private async readPlaces(userId: string) {
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
          AND "storageProvider" IN (${Prisma.join(storageProviderTypes.map((type) => Prisma.sql`${type}::"StorageProviderType"`))})
          AND "storageKey" IS NOT NULL
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
      where: {
        ...visualAssetWhere(userId),
        id: assetId,
        processingStatus: 'FAILED',
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
          storageProvider: true,
          storageBucket: true,
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
    const locations = new Map<
      string,
      {
        location: StorageLocation;
        keys: Set<string>;
        hlsCounts: Map<string, number>;
      }
    >();
    for (const file of removed) {
      const identifier = JSON.stringify([
        file.storageProvider,
        file.storageBucket,
      ]);
      let group = locations.get(identifier);
      if (!group) {
        group = { location: file, keys: new Set(), hlsCounts: new Map() };
        locations.set(identifier, group);
      }
      for (const key of [
        file.storageKey,
        file.thumbnailKey,
        file.previewKey,
        file.hlsKey,
      ])
        if (key) group.keys.add(key);
      if (file.hlsKey) group.hlsCounts.set(file.hlsKey, file.hlsSegmentCount);
    }
    let cleanupPending = 0;
    for (const { location, keys, hlsCounts } of locations.values()) {
      let references: Set<string>;
      try {
        references = await referencedStorageKeys(
          this.prisma,
          [...keys],
          location,
        );
      } catch (error) {
        for (const key of keys)
          this.logger.error(
            `回收站引用检查失败，保留待清理对象：${location.storageProvider}/${location.storageBucket ?? '-'} ${key}`,
            error instanceof Error ? error.stack : String(error),
          );
        cleanupPending += keys.size;
        continue;
      }
      for (const key of keys) {
        try {
          if (references.has(key)) continue;
          const storage = this.storage.for(location);
          const objects = hlsCounts.has(key)
            ? hlsObjectKeys(key, hlsCounts.get(key)!)
            : [key];
          for (let offset = 0; offset < objects.length; offset += 16)
            await Promise.all(
              objects
                .slice(offset, offset + 16)
                .map((objectKey) => storage.delete(objectKey)),
            );
        } catch (error) {
          cleanupPending += 1;
          this.logger.error(
            `回收站记录已删除，存储对象待管理员清理：${location.storageProvider}/${location.storageBucket ?? '-'} ${key}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }
    return { count: removed.length, cleanupPending };
  }
}
