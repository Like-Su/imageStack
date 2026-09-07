import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const cursorSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.string().min(1).max(128),
    createdAt: z.string().datetime({ precision: 3 }),
    id: z.string().min(1).max(128),
  })
  .strict();

// 编码为 BASE64
export function encodeAssetCursor(
  row: { id: string; createdAt: Date },
  ownerId: string,
): string {
  const payload = {
    version: 1,
    ownerId,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

// 解码 BASE64
export function decodeAssetCursor(cursor: string, ownerId: string) {
  try {
    if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
      throw new Error();
    }

    const bytes = Buffer.from(cursor, 'base64url');

    if (bytes.toString('base64url') !== cursor) {
      throw new Error();
    }

    const payload = cursorSchema.parse(JSON.parse(bytes.toString('utf8')));

    const createdAt = new Date(payload.createdAt);

    if (
      payload.ownerId !== ownerId ||
      !Number.isFinite(createdAt.getTime()) ||
      createdAt.toISOString() !== payload.createdAt
    ) {
      throw new Error();
    }

    return {
      id: payload.id,
      createdAt,
    };
  } catch {
    throw new BadRequestException('游标无效，请重新加载列表');
  }
}
