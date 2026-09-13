import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { Subject } from 'rxjs';
import { VIDEO_SUMMARY_NOTIFY_CHANNEL } from './video-summary-state';
import {
  WORKSPACE_NOTIFY_CHANNEL,
  parseWorkspaceNotification,
  type WorkspaceNotification,
} from '../../common/workspace-notifications';

@Injectable()
export class VideoSummaryNotifierService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  readonly changes = new Subject<string | undefined>();
  readonly workspaceChanges = new Subject<WorkspaceNotification | undefined>();
  private readonly logger = new Logger(VideoSummaryNotifierService.name);
  private client?: InstanceType<typeof Client>;
  private connecting?: Promise<void>;
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private delay = 1000;
  private lastWarningAt = 0;

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap() {
    this.connect();
  }

  private connect() {
    if (this.stopped || this.client) return;
    const client = new Client({
      connectionString: this.config.getOrThrow<string>('DATABASE_URL'),
      application_name: 'image-stack-video-events',
      connectionTimeoutMillis: 5000,
      keepAlive: true,
    });
    this.client = client;
    const disconnected = () => {
      if (this.client !== client) return;
      this.client = undefined;
      void client.end().catch(() => undefined);
      if (this.stopped) return;
      if (Date.now() - this.lastWarningAt > 60000) {
        this.lastWarningAt = Date.now();
        this.logger.warn('视频状态通知连接中断，将自动重连并补发事件');
      }
      this.timer = setTimeout(() => this.connect(), this.delay);
      this.timer.unref();
      this.delay = Math.min(30000, this.delay * 2);
    };
    client.on('error', disconnected);
    client.on('end', disconnected);
    client.on(
      'notification',
      (notification: { channel: string; payload?: string }) => {
        if (
          this.stopped ||
          this.client !== client ||
          ![VIDEO_SUMMARY_NOTIFY_CHANNEL, WORKSPACE_NOTIFY_CHANNEL].includes(
            notification.channel,
          ) ||
          !notification.payload
        )
          return;
        try {
          const value: unknown = JSON.parse(notification.payload);
          if (notification.channel === WORKSPACE_NOTIFY_CHANNEL) {
            const change = parseWorkspaceNotification(value);
            if (change) this.workspaceChanges.next(change);
            return;
          }
          if (
            value &&
            typeof value === 'object' &&
            'ownerId' in value &&
            typeof value.ownerId === 'string'
          )
            this.changes.next(value.ownerId);
        } catch {}
      },
    );
    const connecting = (async () => {
      try {
        await client.connect();
        await client.query(`LISTEN ${VIDEO_SUMMARY_NOTIFY_CHANNEL}`);
        await client.query(`LISTEN ${WORKSPACE_NOTIFY_CHANNEL}`);
        if (this.stopped || this.client !== client) return;
        this.delay = 1000;
        this.changes.next(undefined);
        this.workspaceChanges.next(undefined);
      } catch {
        disconnected();
      }
    })();
    this.connecting = connecting;
    void connecting.finally(() => {
      if (this.connecting === connecting) this.connecting = undefined;
    });
  }

  async onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.changes.complete();
    this.workspaceChanges.complete();
    const client = this.client;
    this.client = undefined;
    if (client) await client.end().catch(() => undefined);
    await this.connecting;
  }
}
