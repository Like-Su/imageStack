import { z } from 'zod';
import {
  textSchema,
  uniqueStrings,
} from '../../../common/schemas/fields.schema';

export const confirmAssetTagsSchema = z.strictObject({
  mode: z.enum(['existing', 'create']),
  names: z.array(textSchema(1, 100)).max(50).default([]),
  tagIds: z
    .array(textSchema(1, 128))
    .max(50)
    .refine(uniqueStrings, { error: '标签 ID 不能重复' })
    .default([]),
});
export type ConfirmAssetTagsInput = z.infer<typeof confirmAssetTagsSchema>;
