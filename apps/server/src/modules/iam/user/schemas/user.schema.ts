import { z } from 'zod';
import {
  emailSchema,
  passwordSchema,
} from '../../../../common/schemas/fields.schema';
import { UserStatus } from '../../../../infrastructure/prisma/generated/prisma/enums';
import { iamPageSchema, permissionCodesSchema } from '../../schemas/iam.schema';

export const updateProfileSchema = z.strictObject({
  username: z
    .string({ error: '昵称需为 1–80 个字符' })
    .trim()
    .min(1, { error: '昵称需为 1–80 个字符' })
    .max(80, { error: '昵称需为 1–80 个字符' }),
  avatar: z
    .string()
    .max(65536, { error: '头像数据过大，请重新选择图片' })
    .nullish(),
});

export const createUserSchema = permissionCodesSchema.partial().extend({
  username: z.string().trim().min(1).max(80),
  email: emailSchema.toLowerCase(),
  password: passwordSchema,
  status: z.enum(UserStatus).optional(),
  roleId: z.string().min(1).max(100).optional(),
});

export const updateUserSchema = createUserSchema.partial();
export const listUsersSchema = iamPageSchema.extend({
  status: createUserSchema.shape.status,
  roleId: createUserSchema.shape.roleId,
});
export const deleteUserSchema = z.strictObject({
  id: z.string().min(1).max(100),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
