import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class SystemService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async health() {
    const [database, redis] = await Promise.all([
      this.probe(() => this.prismaService.$queryRaw`SELECT 1`),
      this.probe(() => this.redisService.ping()),
    ]);

    const healthy = database.status === 'up' && redis.status === 'up';

    return {
      status: healthy ? 'ok' : 'degraded',
      checks: {
        database,
        redis,
      },
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async probe(
    run: () => Promise<unknown>,
  ): Promise<{ status: 'up' | 'down'; latencyMs: number }> {
    const startedAt = Date.now();
    try {
      await run();
      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
      };
    } catch (e) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
      };
    }
  }
}
