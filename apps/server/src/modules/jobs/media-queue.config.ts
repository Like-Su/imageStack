import { ConfigService } from '@nestjs/config';
import {
  MEDIA_QUEUE_NAME,
  mediaRetryDelay,
} from './media-processing.constants';

export function mediaRetryQueue(queueName: string, delayMs: number): string {
  return `${queueName}.retry.${delayMs}`;
}

export function mediaQueueConfig(config: ConfigService) {
  const connectionUrl = config.get<string>(
    'RABBITMQ_URL',
    'amqp://guest:guest@172.22.196.208:5672',
  );

  let url: URL;

  try {
    url = new URL(connectionUrl);
  } catch {
    throw new Error('RABBITMQ_URL 必须是有效的 RabbitMQ 连接地址');
  }

  if (!['amqp:', 'amqps:'].includes(url.protocol) || !url.hostname) {
    throw new Error('RABBITMQ_URL 必须使用 amqp/amqps 协议');
  }

  const prefix = config.get<string>('RABBITMQ_QUEUE_PREFIX', 'image-stack');
  const queueName = `${prefix}.${MEDIA_QUEUE_NAME}`;
  const attempts = config.get<number>('MEDIA_PROCESSING_ATTEMPTS', 3);
  const backoffMs = config.get<number>('MEDIA_PROCESSING_BACKOFF_MS', 1000);
  const retryQueues: { name: string; delayMs: number }[] = [];

  for (let attempt = 1; attempt < Math.max(attempts, 2); attempt += 1) {
    const delayMs = mediaRetryDelay(backoffMs, attempt);
    retryQueues.push({ name: mediaRetryQueue(queueName, delayMs), delayMs });
  }

  return {
    url: connectionUrl,
    queueName,
    failedQueue: `${queueName}.failed`,
    retryQueues,
    backoffMs,
    connectTimeoutMs: config.get<number>('RABBITMQ_CONNECT_TIMEOUT_MS', 10000),
    publishTimeoutMs: config.get<number>('RABBITMQ_PUBLISH_TIMEOUT_MS', 5000),
  };
}
