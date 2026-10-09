import { z } from 'zod';
import { permissionCodesSchema } from '../../schemas/iam.schema';

export const createRoleSchema = permissionCodesSchema.partial().extend({
  roleName: z.string().trim().min(1).max(80),
  roleCode: z
    .string()
    .trim()
    .max(100)
    .regex(/^ROLE_[A-Z][A-Z0-9_]*$/),
  description: z.string().trim().max(500).optional(),
  status: z.union([z.literal(0), z.literal(1)]).optional(),
});
export const updateRoleSchema = createRoleSchema.partial();

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
