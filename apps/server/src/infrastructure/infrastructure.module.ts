import { Module } from '@nestjs/common';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    StorageModule,
    RabbitMqModule,
    MailModule,
  ],
  exports: [
    PrismaModule,
    RedisModule,
    StorageModule,
    RabbitMqModule,
    MailModule,
  ],
})
export class InfrastructureModule {}
