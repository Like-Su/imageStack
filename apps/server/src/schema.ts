import { isAbsolute } from 'node:path';
import { z } from 'zod';

// 环境变量
export const envSchema = z.object({
  // 基础配置
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('/api'),
  CORS_ORIGIN: z.string().default('*'),
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Redis
  REDIS_URL: z.string().min(1).default('redis://localhost:6379/0'),
  REDIS_KEY_PREFIX: z.string().default('image-stack:'),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().int().min(0).default(3),

  // 邮箱配置
  MAIL_HOST: z.string().min(1),
  MAIL_PORT: z.string(),
  MAIL_SECURE: z.string(),
  MAIL_PASS: z.string(),
  MAIL_USER: z.string(),
  MAIL_SEND_FROM: z.string(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET 最少 32 位'),
  JWT_ACCESS_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(2 * 60 * 60),
  JWT_REFRESH_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),
  APP_DOMAIN: z.string().min(1),

  // Storage
  STORAGE_DRIVER: z.enum(['LOCAL_FS']).default('LOCAL_FS'),
  STORAGE_ROOT: z
    .string()
    .trim()
    .min(1, 'STORAGE_ROOT is required')
    .refine(isAbsolute, 'STORAGE_ROOT 必须是绝对路径'),
  STORAGE_MAX_FILE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .default(1024 * 1024 * 1024),
});
