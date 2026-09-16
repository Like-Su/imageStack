import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { Prisma } from '../../prisma/generated/prisma/client';
import { decodeAssetCursor, encodeAssetCursor } from './assets.cursor';
import type { ListAssetsDto } from './dto/assets-query.dto';

type AssetSort = {
  sortBy: 'createdAt' | 'name' | 'size';
  sortOrder: 'asc' | 'desc';
};

type AssetPageCursor = { id: string } & (
  | { sortBy: 'createdAt'; value: Date }
  | { sortBy: 'name'; value: string }
  | { sortBy: 'size'; value: bigint | null }
);

const cursorFields = {
  version: z.literal(2),
  ownerId: z.string().min(1).max(128),
  id: z
    .string()
    .min(1)
    .max(128)
    .refine((value) => !value.includes('\u0000')),
  sortOrder: z.enum(['asc', 'desc']),
  scope: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
};

const cursorSchema = z.discriminatedUnion('sortBy', [
  z
    .object({
      ...cursorFields,
      sortBy: z.literal('createdAt'),
      value: z.string().datetime({ precision: 3 }),
    })
    .strict(),
  z
    .object({
      ...cursorFields,
      sortBy: z.literal('name'),
      value: z
        .string()
        .min(1)
        .max(255)
        .refine((value) => !value.includes('\u0000')),
    })
    .strict(),
  z
    .object({
      ...cursorFields,
      sortBy: z.literal('size'),
      value: z
        .string()
        .regex(/^(0|[1-9]\d{0,18})$/)
        .refine((value) => BigInt(value) <= 9223372036854775807n)
        .nullable(),
    })
    .strict(),
]);

export function assetSort(
  query: Pick<ListAssetsDto, 'sortBy' | 'sortOrder'>,
): AssetSort {
  return {
    sortBy: query.sortBy ?? 'createdAt',
    sortOrder: query.sortOrder ?? 'desc',
  };
}

export function assetOrderBy(
  sort: AssetSort,
): Prisma.FileNodeOrderByWithRelationInput[] {
  const order = sort.sortOrder;
  if (sort.sortBy === 'size')
    return [{ size: { sort: order, nulls: 'last' } }, { id: order }];
  if (sort.sortBy === 'name') return [{ name: order }, { id: order }];
  return [{ createdAt: order }, { id: order }];
}

export function encodeAssetPageCursor(
  row: { id: string; createdAt: Date; name: string; size: bigint | null },
  ownerId: string,
  sort: AssetSort,
  scope?: string,
) {
  if (sort.sortBy === 'createdAt' && sort.sortOrder === 'desc')
    return encodeAssetCursor(row, ownerId, scope);
  const value =
    sort.sortBy === 'createdAt'
      ? row.createdAt.toISOString()
      : sort.sortBy === 'name'
        ? row.name
        : (row.size?.toString() ?? null);
  return Buffer.from(
    JSON.stringify({
      version: 2,
      ownerId,
      id: row.id,
      ...sort,
      value,
      scope,
    }),
  ).toString('base64url');
}

export function decodeAssetPageCursor(
  cursor: string,
  ownerId: string,
  sort: AssetSort,
  scope?: string,
): AssetPageCursor {
  if (sort.sortBy === 'createdAt' && sort.sortOrder === 'desc') {
    const previous = decodeAssetCursor(cursor, ownerId, scope);
    return { id: previous.id, sortBy: 'createdAt', value: previous.createdAt };
  }
  try {
    if (cursor.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw new Error();
    const bytes = Buffer.from(cursor, 'base64url');
    if (bytes.toString('base64url') !== cursor) throw new Error();
    const payload = cursorSchema.parse(JSON.parse(bytes.toString('utf8')));
    if (
      payload.ownerId !== ownerId ||
      payload.scope !== scope ||
      payload.sortBy !== sort.sortBy ||
      payload.sortOrder !== sort.sortOrder
    )
      throw new Error();
    if (payload.sortBy === 'createdAt') {
      const value = new Date(payload.value);
      if (
        !Number.isFinite(value.getTime()) ||
        value.toISOString() !== payload.value
      )
        throw new Error();
      return { id: payload.id, sortBy: 'createdAt', value };
    }
    if (payload.sortBy === 'name')
      return { id: payload.id, sortBy: 'name', value: payload.value };
    return {
      id: payload.id,
      sortBy: 'size',
      value: payload.value === null ? null : BigInt(payload.value),
    };
  } catch {
    throw new BadRequestException('游标无效，请重新加载列表');
  }
}

export function assetCursorWhere(
  cursor: AssetPageCursor,
  sort: AssetSort,
): Prisma.FileNodeWhereInput {
  const comparison = sort.sortOrder === 'asc' ? 'gt' : 'lt';
  const id = { [comparison]: cursor.id };
  if (cursor.sortBy === 'createdAt') {
    return {
      OR: [
        { createdAt: { [comparison]: cursor.value } },
        { createdAt: cursor.value, id },
      ],
    };
  }
  if (cursor.sortBy === 'name') {
    return {
      OR: [
        { name: { [comparison]: cursor.value } },
        { name: cursor.value, id },
      ],
    };
  }
  if (cursor.value === null) return { size: null, id };
  return {
    OR: [
      { size: { [comparison]: cursor.value } },
      { size: cursor.value, id },
      { size: null },
    ],
  };
}
