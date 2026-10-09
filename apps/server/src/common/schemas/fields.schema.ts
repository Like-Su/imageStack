import { z } from 'zod';

/** Trim human-entered labels without silently coercing objects or numbers. */
export const textSchema = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !value.includes('\u0000'), {
      error: '不能包含空字符',
    });

export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => !value.includes('\u0000'), {
    error: '标识不能包含空字符',
  });

export const uniqueStrings = (values: string[]) =>
  new Set(values).size === values.length;

/** Query numbers are scalar values; arrays, booleans and empty strings are invalid. */
export const queryIntegerSchema = (min: number, max: number) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
    z.number().int().min(min).max(max),
  );

export const queryBooleanSchema = z.preprocess(
  (value) => (value === 'true' ? true : value === 'false' ? false : value),
  z.boolean(),
);

/** Optional filters treat null as absent; writable nullable fields use nullish(). */
export const optionalQuery = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === null ? undefined : value),
    schema.optional(),
  );

export const emailSchema = z.string().trim().max(254).check(z.email());

export const passwordSchema = z
  .string()
  .refine((value) => Array.from(value).length >= 8, {
    error: '新密码至少需要 8 位',
  })
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    error: '新密码不能超过 72 字节',
  });
