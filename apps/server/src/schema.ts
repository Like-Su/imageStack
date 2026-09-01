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
});
