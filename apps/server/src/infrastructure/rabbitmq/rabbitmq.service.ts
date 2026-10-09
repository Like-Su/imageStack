import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqp-connection-manager';
import type { AmqpConnectionManager } from 'amqp-connection-manager';
import { rabbitMqConfig } from './rabbitmq.config';

@Injectable()
export class RabbitMqService implements OnApplicationShutdown {
  private readonly connections = new Set<AmqpConnectionManager>();

  constructor(private readonly config: ConfigService) {}

  createConnection(): AmqpConnectionManager {
    const settings = rabbitMqConfig(this.config);
    const connection = connect([settings.url], {
      heartbeatIntervalInSeconds: 15,
      reconnectTimeInSeconds: 5,
      connectionOptions: { timeout: settings.connectTimeoutMs },
    });
    this.connections.add(connection);
    return connection;
  }

  async closeConnection(connection: AmqpConnectionManager): Promise<void> {
    if (!this.connections.has(connection)) return;
    await connection.close();
    this.connections.delete(connection);
  }

  // 业务模块先在 onModuleDestroy 中取消消费、等待在途任务并关闭通道。
  async onApplicationShutdown(): Promise<void> {
    await Promise.all(
      [...this.connections].map((connection) =>
        this.closeConnection(connection),
      ),
    );
  }
}
