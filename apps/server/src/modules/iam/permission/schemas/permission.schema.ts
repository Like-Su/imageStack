import { z } from 'zod';
import { permissionCodePattern } from '../../schemas/iam.schema';

export const createPermissionSchema = z.strictObject({
  permissionName: z.string().trim().min(1).max(80),
  permissionCode: z.string().trim().max(100).regex(permissionCodePattern),
  parentId: z.string().min(1).max(100).nullish(),
});
export const updatePermissionSchema = createPermissionSchema.partial();

export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
