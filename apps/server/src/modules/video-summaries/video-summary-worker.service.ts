import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoSummariesService } from './video-summaries.service';
import { VIDEO_SUMMARY_INTERVAL_MS } from './video-summary.constants';

@Injectable()
export class VideoSummaryWorkerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(VideoSummaryWorkerService.name);
  private readonly controller = new AbortController();
  private readonly active = new Set<Promise<void>>();
  private polling?: Promise<void>;
  private timer?: NodeJS.Timeout;
  private unsubscribe?: () => void;
  private delay = VIDEO_SUMMARY_INTERVAL_MS;
  private wakeRequested = false;
  private lastWarningAt = 0;

  constructor(
    private readonly summaries: VideoSummariesService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (!this.summaries.enabled) {
      this.logger.log(`视频总结等待配置：${this.summaries.configurationError}`);
      return;
    }
    this.unsubscribe = this.summaries.onQueued(() => this.wake());
    this.trigger();
  }

  private wake() {
    this.delay = VIDEO_SUMMARY_INTERVAL_MS;
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
        if (Date.now() - this.lastWarningAt < 60000) return;
        this.lastWarningAt = Date.now();
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : 'UNKNOWN';
        this.logger.warn(
          code === 'P2021' || code === 'P2022'
            ? '视频总结表或字段缺失，请执行 pnpm --dir apps/server run db:migrate'
            : `视频总结队列暂不可用 [${code}]，请检查数据库连接`,
        );
      })
      .finally(() => {
        this.polling = undefined;
        if (this.controller.signal.aborted) return;
        if (this.wakeRequested) {
          this.trigger();
          return;
        }
        this.timer = setTimeout(() => this.trigger(), this.delay);
        this.timer.unref();
      });
  }

  private async poll() {
    const available =
      this.config.get<number>('VIDEO_SUMMARY_CONCURRENCY', 1) -
      this.active.size;
    if (available <= 0) return;
    const records = await this.summaries.runnable(available);
    this.delay = records.length
      ? VIDEO_SUMMARY_INTERVAL_MS
      : Math.min(30000, this.delay * 2);
    this.lastWarningAt = 0;
    for (const record of records) {
      if (this.controller.signal.aborted) return;
      const work = this.summaries
        .process(record.assetId, record.asset.ownerId, this.controller.signal)
        .catch(() =>
          this.logger.warn(
            `视频 ${record.assetId} 的总结状态写入失败，租约到期后将恢复`,
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
