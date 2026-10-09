import { z } from 'zod';
import {
  queryIntegerSchema,
  uniqueStrings,
} from '../../../common/schemas/fields.schema';

export const permissionCodePattern = /^[a-z][a-z0-9_-]*(?::[a-z][a-z0-9_-]*)+$/;
export const permissionCodeSchema = z
  .string()
  .max(100)
  .regex(permissionCodePattern);

export const permissionCodesSchema = z.strictObject({
  permissionCodes: z
    .array(permissionCodeSchema)
    .max(500)
    .refine(uniqueStrings, { error: '权限编码不能重复' }),
});

export const iamPageSchema = z.strictObject({
  page: queryIntegerSchema(1, 1000000).default(1),
  limit: queryIntegerSchema(1, 100).default(20),
  search: z.string().trim().max(100).optional(),
});

export type PermissionCodesInput = z.infer<typeof permissionCodesSchema>;
export type IamPageQuery = z.infer<typeof iamPageSchema>;
