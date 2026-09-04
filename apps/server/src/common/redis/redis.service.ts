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
  private prefixKey: string;

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

    this.redis.on('connect', this.onConnect);
    this.redis.on('error', this.onError);

    try {
      await this.redis.connect();
      await this.redis.ping();
    } catch (e) {
      this.redis.disconnect();
      throw e;
    }
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
      this.prefixKey = null;
    }
  }

  // 监听 启动成功与错误
  private readonly onConnect = () => {
    this.logger.log(`Redis connected`);
  };

  private readonly onError = (error: Error) => {
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

  get prefix() {
    if (this.prefixKey === null) {
      const prefix = this.configService.get<string>('REDIS_KEY_PREFIX');
      this.prefixKey = prefix.endsWith(':') ? prefix : prefix + ':';
    }
    return this.prefixKey;
  }

  // redis 基础操作
  async get(key: string) {
    return await this.client.get(this.prefix + key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds !== undefined) {
      return this.client.set(this.prefix + key, value, 'EX', ttlSeconds);
    }
    return this.client.set(this.prefix + key, value);
  }

  async del(...keys: string[]) {
    if (keys.length === 0) return 0;
    return await this.client.del(...keys.map((key) => this.prefix + key));
  }

  async expire(key: string, ttlSeconds: number) {
    const res = await this.client.expire(this.prefix + key, ttlSeconds);
    return res === 1;
  }

  async ttl(key: string) {
    return this.client.ttl(this.prefix + key);
  }

  // 实现原子操作: 解决竞态条件(同一个验证码可能被两个请求同时消费), LUA 在 Redis 作为原子操作执行
  async consume(key: string, expectedValue: string) {
    const fullKey = this.prefix + key;
    const script = `
      local current = redis.call("GET", KEYS[1])

      if current == ARGV[1] then
        redis.call("DEL", KEYS[1])
        return 1
      end
      return 0
    `;

    const result = await this.client.eval(script, 1, fullKey, expectedValue);

    return Number(result) === 1;
  }
}
