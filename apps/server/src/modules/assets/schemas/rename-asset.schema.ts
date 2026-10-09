import { z } from 'zod';

export const renameAssetSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[^/\\\u0000-\u001f\u007f]+$/u, {
      error: '文件名称不能包含路径分隔符或控制字符',
    }),
});
export type RenameAssetInput = z.infer<typeof renameAssetSchema>;
