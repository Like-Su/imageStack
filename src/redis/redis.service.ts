import { Inject, Injectable } from '@nestjs/common';
import { RedisClientType } from 'redis';
import { REDIS_CLIENT } from 'src/constants';

@Injectable()
export class RedisService {
  @Inject(REDIS_CLIENT)
  private readonly redisClient: RedisClientType;

  async get(key: string) {
    return await this.redisClient.get(key);
  }

  async set(key: string, value: string | number, ttl?: number) {
    await this.redisClient.set(key, value);
    if (ttl) {
      await this.redisClient.expire(key, ttl);
    }
    return true;
  }

  async del(key: string) {
    return await this.redisClient.del(key);
  }
}
