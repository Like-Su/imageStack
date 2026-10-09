import { z } from 'zod';
import {
  textSchema,
  uniqueStrings,
} from '../../../common/schemas/fields.schema';

export const assetIdsSchema = z.strictObject({
  ids: z
    .array(textSchema(1, 128))
    .min(1)
    .max(100)
    .refine(uniqueStrings, { error: '资源 ID 不能重复' }),
});
export type AssetIdsInput = z.infer<typeof assetIdsSchema>;
