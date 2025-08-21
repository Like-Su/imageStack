import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';
import { UnNeedLogin } from './interface.guard.decorator';

@Controller()
export class AppController {
  @Inject(RedisService)
  private readonly redisService: RedisService;
  constructor(private readonly appService: AppService) {}

  @UnNeedLogin()
  @Get()
  async test() {}
}
