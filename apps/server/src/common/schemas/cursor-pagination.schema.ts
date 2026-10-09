import { z } from 'zod';
import { optionalQuery, queryIntegerSchema } from './fields.schema';

export const cursorPaginationSchema = z.strictObject({
  limit: queryIntegerSchema(1, 100).default(24),
  cursor: optionalQuery(z.string().min(1).max(4096)),
});

export type CursorPagination = z.infer<typeof cursorPaginationSchema>;
