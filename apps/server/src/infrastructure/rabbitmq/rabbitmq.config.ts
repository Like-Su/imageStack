import { ConfigService } from '@nestjs/config';

export function rabbitMqConfig(config: ConfigService) {
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

  return {
    url: connectionUrl,
    queuePrefix: config.get<string>('RABBITMQ_QUEUE_PREFIX', 'image-stack'),
    connectTimeoutMs: config.get<number>('RABBITMQ_CONNECT_TIMEOUT_MS', 10000),
    publishTimeoutMs: config.get<number>('RABBITMQ_PUBLISH_TIMEOUT_MS', 5000),
  };
}
