import { registerAs } from '@nestjs/config';
export const redisConfig = registerAs('redis', () => {
  return {
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/0',
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'image-stack:',
    connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 10000),
    maxRetriesPerRequest: Number(
      process.env.REDIS_MAX_RETRIES_PER_REQUEST ?? 3,
    ),
  };
});

export type RedisConfig = ReturnType<typeof redisConfig>;
