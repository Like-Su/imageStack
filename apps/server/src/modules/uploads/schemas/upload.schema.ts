import { z } from 'zod';

export const createUploadSessionSchema = z.strictObject({
  albumId: z.string().min(1).max(128).nullish(),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^(?!\.{1,2}$)[^/\\\u0000-\u001f\u007f]+$/u, {
      error: 'fileName 不能包含路径分隔符或控制字符',
    }),
  size: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/, {
      error: 'hash 必须是 64 位小写十六进制 BLAKE3',
    })
    .nullish(),
});
export type CreateUploadSessionInput = z.infer<
  typeof createUploadSessionSchema
>;
