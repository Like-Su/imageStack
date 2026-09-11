import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../../prisma/generated/prisma/client';
import type { ListAssetsDto } from './dto/assets-query.dto';

const mediaTypes = {
  image: 'IMAGE',
  video: 'VIDEO',
  audio: 'AUDIO',
} as const;

function dateBound(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined;

  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1 ||
    date.getUTCFullYear() > 9999
  ) {
    throw new BadRequestException('时间筛选必须是有效的日期或带时区的时间');
  }
  return date;
}

export function buildAssetFilters(
  userId: string,
  query: ListAssetsDto,
  keywords: readonly string[] = [],
): Prisma.FileNodeWhereInput {
  const conditions: Prisma.FileNodeWhereInput[] = [];

  if (query.type) conditions.push({ mediaType: mediaTypes[query.type] });
  if (query.favorite !== undefined) {
    conditions.push({ isFavorite: query.favorite });
  }
  if (query.uncategorized !== undefined) {
    conditions.push({
      albums: query.uncategorized
        ? { none: { album: { ownerId: userId } } }
        : { some: { album: { ownerId: userId } } },
    });
  }
  if (query.minSize !== undefined) {
    conditions.push({ size: { gte: BigInt(query.minSize) } });
  }
  if (query.placeId) {
    const [latitudeCell, longitudeCell] = query.placeId.split(':').map(Number);
    if (
      !Number.isInteger(latitudeCell) ||
      !Number.isInteger(longitudeCell) ||
      latitudeCell < -900 ||
      latitudeCell > 900 ||
      longitudeCell < -1800 ||
      longitudeCell > 1800
    ) {
      throw new BadRequestException('地点坐标无效');
    }
    conditions.push(
      {
        exif: {
          path: ['latitude'],
          gte: latitudeCell / 10,
          lt: (latitudeCell + 1) / 10,
        },
      },
      {
        exif: {
          path: ['longitude'],
          gte: longitudeCell / 10,
          lt: (longitudeCell + 1) / 10,
        },
      },
    );
  }
  if (query.status === 'PENDING') {
    conditions.push({
      OR: [{ processingStatus: 'PENDING' }, { processingStatus: null }],
    });
  } else if (query.status) {
    conditions.push({ processingStatus: query.status });
  }
  if (query.albumId) {
    conditions.push({
      albums: { some: { album: { id: query.albumId, ownerId: userId } } },
    });
  }
  if (query.tagId || query.tag) {
    conditions.push({
      tags: {
        some: {
          tag: {
            ownerId: userId,
            ...(query.tagId ? { id: query.tagId } : {}),
            ...(query.tag ? { name: query.tag } : {}),
          },
        },
      },
    });
  }

  const from = dateBound(query.from);
  const to = dateBound(query.to);
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestException('from 必须早于 to，to 为不包含的时间上界');
  }

  const ranges: { gte?: Date; lt?: Date; lte?: Date }[] = [];
  if (from || to) {
    ranges.push({ ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) });
  }
  if (query.year !== undefined) {
    const start = new Date(0);
    start.setUTCFullYear(query.year, 0, 1);
    const end = new Date(start);
    end.setUTCFullYear(query.year + 1);
    end.setTime(end.getTime() - 1);
    ranges.push({ gte: start, lte: end });
  }
  for (const range of ranges) {
    conditions.push(
      query.timeField === 'takenAt' ? { takenAt: range } : { createdAt: range },
    );
  }

  for (const keyword of keywords) {
    const literal = keyword.replace(/[\\%_]/g, (character) => `\\${character}`);
    conditions.push({
      OR: [
        { name: { contains: literal, mode: 'insensitive' } },
        {
          recognition: {
            is: {
              status: 'READY',
              searchText: { contains: literal, mode: 'insensitive' },
            },
          },
        },
        {
          tags: {
            some: {
              tag: {
                ownerId: userId,
                name: { contains: literal, mode: 'insensitive' },
              },
            },
          },
        },
      ],
    });
  }

  return { AND: conditions };
}
