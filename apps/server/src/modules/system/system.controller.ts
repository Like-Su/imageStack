import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SystemService } from './system.service';
import { Open } from '../iam/auth/decorators/open.decorator';
import { SkipResponseWrap } from 'src/common/decorators/skip-response-wrap.decorator';
import { Response } from 'express';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Open()
  @Get('health')
  @SkipResponseWrap()
  async health(@Res({ passthrough: true }) response: Response) {
    const result = await this.systemService.health();

    response.status(
      result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return result;
  }
}
