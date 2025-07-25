import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';

@Controller()
export class AppController {
  @Inject(RedisService)
  private readonly redisService: RedisService;

  constructor(private readonly appService: AppService) {}

  @Get()
  async getHello(): Promise<string> {
    return this.appService.getHello();
  }
}
