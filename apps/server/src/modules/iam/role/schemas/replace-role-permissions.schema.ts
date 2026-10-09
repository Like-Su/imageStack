import { z } from 'zod';
import { permissionCodesSchema } from '../../schemas/iam.schema';

export const replaceRolePermissionsSchema = permissionCodesSchema;
export type ReplaceRolePermissionsInput = z.infer<
  typeof replaceRolePermissionsSchema
>;
