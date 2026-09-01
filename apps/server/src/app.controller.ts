import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { BusinessException } from './common/exceptions/business.exception';
import { RedisService } from './common/redis/redis.service';
import { PrismaService } from './common/prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get('error')
  // error 测试
  getError(): string {
    throw new BusinessException(
      'BUSINESS_ERROR',
      'This is a business exception',
      { info: 'Additional details' },
    );
  }

  @Get('unknown-error')
  // 未知错误测试
  getUnknownError(): string {
    throw new Error('This is an unknown error');
  }

  @Get('success')
  // 成功测试
  getSuccess(): string {
    return 'success';
  }

  @Get('redis-status')
  async checkRedis() {
    return await this.redisService.ping();
  }

  @Get('pg-status')
  async checkPg() {
    return await this.prismaService.user.findMany();
  }
}
