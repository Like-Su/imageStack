import { z } from 'zod';
import { queryIntegerSchema } from '../../../common/schemas/fields.schema';

export const shareTargetSchema = z.strictObject({
  kind: z.enum(['asset', 'album']),
  targetId: z.string().min(1).max(100),
});
export const createShareSchema = shareTargetSchema.extend({
  expiresInDays: queryIntegerSchema(0, 30)
    .pipe(z.union([z.literal(0), z.literal(1), z.literal(7), z.literal(30)]))
    .default(7),
});
export const shareTokenSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
});
export const shareAssetSchema = shareTokenSchema.extend({
  assetId: z.string().min(1).max(100),
});
export const sharePageSchema = z.strictObject({
  limit: queryIntegerSchema(1, 100).default(24),
  cursor: z.string().min(1).max(100).optional(),
});

export type ShareTarget = z.infer<typeof shareTargetSchema>;
export type CreateShareInput = z.infer<typeof createShareSchema>;
export type ShareTokenParams = z.infer<typeof shareTokenSchema>;
export type ShareAssetParams = z.infer<typeof shareAssetSchema>;
export type SharePageQuery = z.infer<typeof sharePageSchema>;
