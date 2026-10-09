import { ConfigService } from '@nestjs/config';
import { rabbitMqConfig } from '../../infrastructure/rabbitmq/rabbitmq.config';
import {
  MEDIA_QUEUE_NAME,
  mediaRetryDelay,
} from './media-processing.constants';

export function mediaRetryQueue(queueName: string, delayMs: number): string {
  return `${queueName}.retry.${delayMs}`;
}

export function mediaQueueConfig(config: ConfigService) {
  const rabbitmq = rabbitMqConfig(config);
  const queueName = `${rabbitmq.queuePrefix}.${MEDIA_QUEUE_NAME}`;
  const attempts = config.get<number>('MEDIA_PROCESSING_ATTEMPTS', 3);
  const backoffMs = config.get<number>('MEDIA_PROCESSING_BACKOFF_MS', 1000);
  const retryQueues: { name: string; delayMs: number }[] = [];

  for (let attempt = 1; attempt < Math.max(attempts, 2); attempt += 1) {
    const delayMs = mediaRetryDelay(backoffMs, attempt);
    retryQueues.push({ name: mediaRetryQueue(queueName, delayMs), delayMs });
  }

  return {
    queueName,
    failedQueue: `${queueName}.failed`,
    retryQueues,
    backoffMs,
    publishTimeoutMs: rabbitmq.publishTimeoutMs,
  };
}
