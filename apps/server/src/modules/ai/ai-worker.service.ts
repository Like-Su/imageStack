import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../prisma/generated/prisma/client';
import { AiIndexService } from './ai-index.service';
import { AI_INDEX_INTERVAL_MS } from './ai.constants';

@Injectable()
export class AiWorkerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AiWorkerService.name);
  private readonly controller = new AbortController();
  private readonly active = new Set<Promise<void>>();
  private polling?: Promise<void>;
  private timer?: NodeJS.Timeout;
  private lastQueueWarning?: { code: string; loggedAt: number };

  constructor(
    private readonly index: AiIndexService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (!this.index.enabled) {
      this.logger.log(`AI 识图未启用：${this.index.configurationError}`);
      return;
    }
    this.timer = setInterval(() => this.trigger(), AI_INDEX_INTERVAL_MS);
    this.timer.unref();
    this.trigger();
  }

  private trigger() {
    if (this.polling || this.controller.signal.aborted) return;
    this.polling = this.poll()
      .catch((error: unknown) => this.reportQueueError(error))
      .finally(() => {
        this.polling = undefined;
      });
  }

  private reportQueueError(error: unknown) {
    if (this.controller.signal.aborted) return;
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : error instanceof Prisma.PrismaClientInitializationError
          ? (error.errorCode ?? error.name)
          : error instanceof Error
            ? error.name
            : 'UNKNOWN';
    const now = Date.now();
    if (
      this.lastQueueWarning?.code === code &&
      now - this.lastQueueWarning.loggedAt < 60000
    )
      return;
    this.lastQueueWarning = { code, loggedAt: now };
    if (code === 'P2021' || code === 'P2022') {
      this.logger.warn(
        `识图队列表或字段缺失 [${code}]，请在运行后端的同一环境、项目根目录执行 pnpm --dir apps/server run db:migrate，应用 AI 迁移 20260910220000_ai_image_recognition`,
      );
      return;
    }
    this.logger.warn(
      `识图队列查询失败 [${code}]，请检查 DATABASE_URL、数据库连接及 Prisma 客户端配置`,
    );
  }

  private async poll() {
    const available =
      this.config.get<number>('AI_INDEX_CONCURRENCY', 1) - this.active.size;
    if (available <= 0) return;
    const records = await this.index.runnable(available);
    if (this.lastQueueWarning) {
      this.logger.log('识图队列已恢复');
      this.lastQueueWarning = undefined;
    }
    for (const record of records) {
      if (this.controller.signal.aborted) return;
      const work = this.index
        .process(record.assetId, record.asset.ownerId, this.controller.signal)
        .catch(() =>
          this.logger.warn(
            `图片 ${record.assetId} 的识图状态写入失败，租约到期后将恢复`,
          ),
        )
        .finally(() => {
          this.active.delete(work);
        });
      this.active.add(work);
    }
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    this.controller.abort();
    await this.polling;
    await Promise.allSettled([...this.active]);
  }
}
