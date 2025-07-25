import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from 'src/constants';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Module({
  providers: [
    RedisService,
    {
      provide: REDIS_CLIENT,
      async useFactory(configService: ConfigService) {
        const client = createClient({
          socket: {
            host: configService.get('db.redis.host'),
            port: configService.get('db.redis.port'),
          },
        });

        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
