import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisConfig } from './redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const config = this.configService.get<RedisConfig>('redis');

    if (!config) {
      throw new Error('Redis config not found');
    }

    if (this.redis) return;

    this.redis = new Redis(config.url, {
      lazyConnect: true,
    });

    this.redis.on('connect', this.connectionEnable);
    this.redis.on('error', this.connectionError);

    await this.redis.connect();
    await this.redis.ping();
  }

  async onModuleDestroy() {
    if (!this.redis || this.redis.status === 'end') return;

    try {
      await this.redis.quit();
      this.logger.log(`Redis connection closed`);
    } catch (err) {
      this.logger.warn(
        `Redis quit failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      this.redis.disconnect();
    } finally {
      this.redis = null;
    }
  }

  // 监听 启动成功与错误
  connectionEnable = () => {
    this.logger.log(`Redis connected`);
  };

  connectionError = (error) => {
    this.logger.error(`Redis error: ${error.message}`, error.stack);
  };

  // 获取 客户端
  private get client(): Redis {
    if (!this.redis) throw new Error(`Redis client is not initalized`);
    return this.redis;
  }

  async ping() {
    return (await this.client.ping()) === 'PONG' ? 'success' : 'error';
  }

  // redis 基础操作
  async get(key: string) {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    return await this.client.set(
      key,
      value,
      ttlSeconds ? 'EX' : void 0,
      ttlSeconds,
    );
  }

  async del(...keys: string[]) {
    if (keys.length === 0) return 0;
    return await this.client.del(...keys);
  }

  async expire(key: string, ttlSeconds: number) {
    const res = await this.client.expire(key, ttlSeconds);
    return res === 1;
  }

  async ttl(key: string) {
    return this.client.ttl(key);
  }
}
