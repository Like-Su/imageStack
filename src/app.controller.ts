import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';
import { UnNeedLogin } from './interface.guard.decorator';
import * as fs from 'fs/promises';
import { join } from 'path';

@Controller()
export class AppController {
  @Inject(RedisService)
  private readonly redisService: RedisService;

  constructor(private readonly appService: AppService) { }

  @UnNeedLogin()
  @Get()
  async getHello() {
    return {
      _type: 'application/html',
      data: await fs.readFile(join(__dirname, '..', 'public', 'index.html'), 'utf8')
    }
  }
}
