import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '../../prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({
      adapter,
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log(`Prisma service connected`);
    } catch (e) {
      this.logger.error(
        `Prisma service connection failed`,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log(`Prisma service disconnected`);
    } catch (e) {
      this.logger.error(
        `Prisma service disconnection failed`,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}
