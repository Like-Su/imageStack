import { z } from 'zod';
import { cursorPaginationSchema } from '../../../common/schemas/cursor-pagination.schema';
import {
  idSchema,
  optionalQuery,
  queryBooleanSchema,
  queryIntegerSchema,
  textSchema,
} from '../../../common/schemas/fields.schema';

const dateFilterPattern =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/;
const isoDateSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);
const dateFilterSchema = z
  .string()
  .max(35)
  .regex(dateFilterPattern)
  .refine((value) => isoDateSchema.safeParse(value).success, {
    error: '时间筛选必须是有效的日期或带时区的时间',
  });

export const trashIdsQuerySchema = z.strictObject({
  cursor: optionalQuery(z.string().min(1).max(512)),
});

export const listAssetsSchema = cursorPaginationSchema.extend({
  sortBy: z.enum(['createdAt', 'name', 'size']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  type: optionalQuery(
    z
      .string()
      .trim()
      .toLowerCase()
      .pipe(
        z.enum(['image', 'video', 'audio', 'document', 'archive', 'other']),
      ),
  ),
  timeField: z.enum(['createdAt', 'takenAt']).default('createdAt'),
  year: optionalQuery(queryIntegerSchema(1, 9999)),
  from: optionalQuery(dateFilterSchema),
  to: optionalQuery(dateFilterSchema),
  status: optionalQuery(z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED'])),
  favorite: optionalQuery(queryBooleanSchema),
  uncategorized: optionalQuery(queryBooleanSchema),
  minSize: optionalQuery(queryIntegerSchema(0, Number.MAX_SAFE_INTEGER)),
  placeId: optionalQuery(z.string().regex(/^-?\d{1,4}:-?\d{1,4}$/)),
  albumId: optionalQuery(idSchema),
  tagId: optionalQuery(idSchema),
  tag: optionalQuery(textSchema(1, 100)),
});

export const thumbnailQuerySchema = z.strictObject({
  size: z.literal('sm').default('sm'),
});

export type TrashIdsQuery = z.infer<typeof trashIdsQuerySchema>;
export type ListAssetsQuery = z.infer<typeof listAssetsSchema>;
export type ThumbnailQuery = z.infer<typeof thumbnailQuerySchema>;
