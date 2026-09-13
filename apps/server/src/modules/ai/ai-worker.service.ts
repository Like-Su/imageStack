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
  private delay: number = AI_INDEX_INTERVAL_MS;
  private wakeRequested = false;
  private unsubscribe?: () => void;
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
    this.unsubscribe = this.index.onQueued(() => this.wake());
    this.trigger();
  }

  private wake() {
    this.delay = AI_INDEX_INTERVAL_MS;
    this.wakeRequested = true;
    this.trigger();
  }

  private trigger() {
    if (this.polling || this.controller.signal.aborted) return;
    clearTimeout(this.timer);
    this.wakeRequested = false;
    this.polling = this.poll()
      .catch((error: unknown) => {
        this.delay = Math.min(30000, this.delay * 2);
        this.reportQueueError(error);
      })
      .finally(() => {
        this.polling = undefined;
        if (this.controller.signal.aborted) return;
        if (this.wakeRequested) {
          this.trigger();
          return;
        }
        this.timer = setTimeout(
          () => this.trigger(),
          this.delay + Math.floor(Math.random() * 1000),
        );
        this.timer.unref();
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
    if (available <= 0) {
      this.delay = AI_INDEX_INTERVAL_MS;
      return;
    }
    const records = await this.index.runnable(available);
    this.delay = records.length
      ? AI_INDEX_INTERVAL_MS
      : Math.min(30000, this.delay * 2);
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
          this.wake();
        });
      this.active.add(work);
    }
  }

  async onModuleDestroy() {
    this.unsubscribe?.();
    clearTimeout(this.timer);
    this.controller.abort();
    await this.polling;
    await Promise.allSettled([...this.active]);
  }
}
