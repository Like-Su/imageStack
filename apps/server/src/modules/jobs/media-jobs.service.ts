import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqp-connection-manager';
import type {
  AmqpConnectionManager,
  Channel,
  ChannelWrapper,
} from 'amqp-connection-manager';
import type { ConsumeMessage, Message } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  MEDIA_JOB_NAME,
  mediaAssetWhere,
  runnableMediaWhere,
} from './media-processing.constants';
import type { MediaJobData } from './media-processing.constants';
import { MediaProcessorService } from './media-processor.service';
import { mediaQueueConfig, mediaRetryQueue } from './media-queue.config';

@Injectable()
export class MediaJobsService
  implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MediaJobsService.name);
  private readonly active = new Set<Promise<void>>();
  private readonly publications = new Map<string, { returned: boolean }>();
  private connection: AmqpConnectionManager;
  private publisher: ChannelWrapper;
  private consumer: ChannelWrapper;
  private publishingChannel: Channel | undefined;
  private consumerBinding: { channel: Channel; tag: string } | undefined;
  private settings: ReturnType<typeof mediaQueueConfig>;
  private timer: ReturnType<typeof setInterval> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private producerReady = false;
  private brokerBlocked = false;
  private bootstrapped = false;
  private closing = false;
  private reconciliation: Promise<void> | undefined;
  private afterId: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly processor: MediaProcessorService,
  ) {}

  onModuleInit(): void {
    this.settings = mediaQueueConfig(this.config);
    this.connection = connect([this.settings.url], {
      heartbeatIntervalInSeconds: 15,
      reconnectTimeInSeconds: 5,
      connectionOptions: { timeout: this.settings.connectTimeoutMs },
    });
    this.connection.on('connect', () => {
      this.brokerBlocked = false;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    });
    this.connection.on('disconnect', () => {
      this.producerReady = false;
      this.logger.warn('RabbitMQ 连接中断，待处理记录将由数据库补投');
    });
    this.connection.on('connectFailed', ({ err }) => {
      this.logger.warn(`RabbitMQ 连接暂不可用：${err.message}`);
    });
    this.connection.on('blocked', ({ reason }) => {
      this.brokerBlocked = true;
      this.logger.warn(`RabbitMQ 暂停接收消息：${reason}`);
    });
    this.connection.on('unblocked', () => {
      this.brokerBlocked = false;
      this.triggerReconciliation();
    });

    this.publisher = this.connection.createChannel({
      name: 'media-publisher',
      confirm: true,
      json: true,
      publishTimeout: this.settings.publishTimeoutMs,
      setup: async (channel: Channel) => {
        this.producerReady = false;
        this.publishingChannel = channel;
        channel.on('close', () => {
          if (this.publishingChannel === channel) {
            this.publishingChannel = undefined;
            this.producerReady = false;
          }
          this.scheduleReconnect();
        });
        channel.on('return', (message: Message) => {
          const publication = this.publications.get(
            message.properties.messageId,
          );
          if (publication) publication.returned = true;
          this.producerReady = false;
          this.logger.warn('RabbitMQ 消息无法路由，等待重建媒体队列');
          this.scheduleReconnect();
        });
        await this.assertTopology(channel);
        if (this.publishingChannel === channel && !this.closing) {
          this.producerReady = true;
        }
      },
    });
    this.publisher.on('connect', () => this.triggerReconciliation());
    this.publisher.on('error', (error: Error) => {
      this.producerReady = false;
      this.logger.error(`RabbitMQ 投递通道异常：${error.message}`);
      this.scheduleReconnect();
    });
  }

  onApplicationBootstrap(): void {
    this.bootstrapped = true;
    this.consumer = this.connection.createChannel({
      name: 'media-consumer',
      confirm: false,
      setup: async (channel: Channel) => {
        channel.on('close', () => {
          if (this.consumerBinding?.channel === channel) {
            this.consumerBinding = undefined;
          }
          this.scheduleReconnect();
        });
        await this.assertTopology(channel);
        await Promise.allSettled([...this.active]);
        if (this.closing) return;

        await channel.prefetch(
          this.config.get<number>('MEDIA_PROCESSING_CONCURRENCY', 2),
        );
        const { consumerTag } = await channel.consume(
          this.settings.queueName,
          (message) => this.accept(channel, message),
          { noAck: false },
        );
        this.consumerBinding = { channel, tag: consumerTag };
        if (this.closing) await channel.cancel(consumerTag);
      },
    });
    this.consumer.on('error', (error: Error) => {
      this.logger.error(`RabbitMQ 消费通道异常：${error.message}`);
      this.scheduleReconnect();
    });

    this.timer = setInterval(
      () => {
        this.triggerReconciliation();
      },
      this.config.get<number>('MEDIA_PROCESSING_RECONCILE_INTERVAL_MS', 30000),
    );
    this.timer.unref();
    this.triggerReconciliation();
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    if (this.timer) clearInterval(this.timer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    try {
      if (this.consumerBinding) {
        await this.consumerBinding.channel
          .cancel(this.consumerBinding.tag)
          .catch(() => undefined);
      }
      await this.reconciliation;
      await Promise.allSettled([...this.active]);
    } finally {
      this.producerReady = false;
      await Promise.allSettled([
        this.consumer?.close(),
        this.publisher?.close(),
      ]);
      await this.connection?.close();
    }
  }

  async enqueue(assetId: string, ownerId: string): Promise<boolean> {
    if (!this.producerReady || this.brokerBlocked || this.closing) return false;

    try {
      const asset = await this.prisma.fileNode.findFirst({
        where: {
          ...mediaAssetWhere,
          ...runnableMediaWhere(new Date()),
          id: assetId,
          ownerId,
        },
        select: { id: true },
      });
      if (!asset) return true;

      await this.publish(this.settings.queueName, { assetId, ownerId });
      return true;
    } catch (error) {
      this.logger.warn(
        `媒体任务投递暂缓，将由数据库记录补投：${assetId}；${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  private triggerReconciliation(): void {
    if (
      !this.bootstrapped ||
      !this.producerReady ||
      this.brokerBlocked ||
      this.closing ||
      this.reconciliation
    ) {
      return;
    }

    this.reconciliation = this.reconcile().finally(() => {
      this.reconciliation = undefined;
    });
  }

  private async reconcile(): Promise<void> {
    try {
      const batchSize = this.config.get<number>(
        'MEDIA_PROCESSING_RECONCILE_BATCH_SIZE',
        100,
      );
      const assets = await this.prisma.fileNode.findMany({
        where: {
          ...mediaAssetWhere,
          ...runnableMediaWhere(new Date()),
          ...(this.afterId ? { id: { gt: this.afterId } } : {}),
        },
        select: { id: true, ownerId: true },
        orderBy: { id: 'asc' },
        take: batchSize,
      });

      for (const asset of assets) {
        if (!this.producerReady || this.brokerBlocked || this.closing) return;

        await this.publish(this.settings.queueName, {
          assetId: asset.id,
          ownerId: asset.ownerId,
        });
        this.afterId = asset.id;
      }

      if (assets.length < batchSize) this.afterId = undefined;
    } catch (error) {
      this.logger.warn(
        `媒体任务补投暂缓：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async assertTopology(channel: Channel): Promise<void> {
    await channel.assertQueue(this.settings.failedQueue, { durable: true });
    await channel.assertQueue(this.settings.queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': this.settings.failedQueue,
      },
    });

    for (const retry of this.settings.retryQueues) {
      await channel.assertQueue(retry.name, {
        durable: true,
        arguments: {
          'x-message-ttl': retry.delayMs,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': this.settings.queueName,
        },
      });
    }
  }

  private async publish(
    queueName: string,
    data: MediaJobData,
    headers: Record<string, string | number> = {},
  ): Promise<void> {
    if (
      !this.producerReady ||
      this.brokerBlocked ||
      !this.connection.isConnected()
    ) {
      throw new Error('RabbitMQ 投递通道暂不可用');
    }

    const messageId = randomUUID();
    const publication = { returned: false };
    this.publications.set(messageId, publication);

    try {
      await this.publisher.sendToQueue(queueName, data, {
        messageId,
        correlationId: data.assetId,
        type: MEDIA_JOB_NAME,
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        timestamp: Math.floor(Date.now() / 1000),
        headers: { 'x-media-version': 1, ...headers },
        persistent: true,
        mandatory: true,
        timeout: this.settings.publishTimeoutMs,
      });
      if (publication.returned) throw new Error('RabbitMQ 消息未进入目标队列');
    } finally {
      this.publications.delete(messageId);
    }
  }

  private accept(channel: Channel, message: ConsumeMessage | null): void {
    if (!message) {
      this.scheduleReconnect();
      return;
    }
    if (this.closing) {
      this.settle(channel, message, 'requeue');
      return;
    }

    const handling = this.handleMessage(channel, message)
      .catch((error: unknown) => {
        this.logger.error(
          '媒体消息处理异常',
          error instanceof Error ? error.stack : String(error),
        );
        this.settle(channel, message, 'requeue');
      })
      .finally(() => this.active.delete(handling));
    this.active.add(handling);
  }

  private async handleMessage(
    channel: Channel,
    message: ConsumeMessage,
  ): Promise<void> {
    let data: MediaJobData;

    try {
      data = this.decode(message);
    } catch {
      this.logger.warn('无效媒体消息已拒绝并转入失败队列');
      this.settle(channel, message, 'reject');
      return;
    }

    try {
      const result = await this.processor.process(data);
      if (result.kind === 'retry') {
        await this.publish(
          mediaRetryQueue(this.settings.queueName, result.delayMs),
          data,
          { 'x-media-attempt': result.attempt, 'x-media-error': result.error },
        );
      } else if (result.kind === 'failed') {
        await this.publish(this.settings.failedQueue, data, {
          'x-media-attempt': result.attempt,
          'x-media-error': result.error,
        });
      }
      this.settle(channel, message, 'ack');
    } catch (error) {
      this.logger.warn(
        `媒体消息尚未确认，等待重新投递：${data.assetId}；${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      if (!this.closing) await delay(Math.min(this.settings.backoffMs, 5000));
      this.settle(channel, message, 'requeue');
    }
  }

  private decode(message: ConsumeMessage): MediaJobData {
    if (
      message.content.length > 4096 ||
      message.properties.contentType !== 'application/json' ||
      message.properties.type !== MEDIA_JOB_NAME ||
      message.properties.headers?.['x-media-version'] !== 1
    ) {
      throw new Error('媒体消息格式无效');
    }

    const value: unknown = JSON.parse(message.content.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('媒体消息内容无效');
    }
    const { assetId, ownerId } = value as Record<string, unknown>;
    if (
      typeof assetId !== 'string' ||
      typeof ownerId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(assetId) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(ownerId)
    ) {
      throw new Error('媒体任务参数无效');
    }
    return { assetId, ownerId };
  }

  private settle(
    channel: Channel,
    message: ConsumeMessage,
    action: 'ack' | 'reject' | 'requeue',
  ): void {
    try {
      if (action === 'ack') channel.ack(message);
      else channel.nack(message, false, action === 'requeue');
    } catch {
      this.logger.warn('媒体消息所属通道已关闭，将由 RabbitMQ 重新投递');
    }
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connection.reconnect();
    }, 5000);
    this.reconnectTimer.unref();
  }
}
