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
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET 最少 32 位').optional(),
  CSRF_COOKIE_SECURE: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
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
  MAIL_SEND_FROM: z.string().min(1, 'MAIL_SEND_FROM is required'),

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
  APP_DOMAIN: z
    .string()
    .url('APP_DOMAIN 必须是有效的前端 URL')
    .regex(/^https?:\/\//, 'APP_DOMAIN 仅支持 HTTP 或 HTTPS'),
});
