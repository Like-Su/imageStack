import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import { PermissionCode } from '../../common/constants';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { systemCapabilities } from './system-capabilities';
import { SystemService } from './system.service';
import { Open } from '../iam/auth/decorators/open.decorator';
import { SkipResponseWrap } from 'src/common/decorators/skip-response-wrap.decorator';
import { Response } from 'express';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('capabilities')
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  capabilities() {
    return systemCapabilities;
  }

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
