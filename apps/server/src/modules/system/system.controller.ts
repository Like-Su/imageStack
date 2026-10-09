import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionCode } from '../../common/constants';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { systemCapabilities } from './system-capabilities';
import { SystemService } from './system.service';
import { Open } from '../iam/auth/decorators/open.decorator';
import { SkipResponseWrap } from 'src/common/decorators/skip-response-wrap.decorator';
import { Response } from 'express';
import { StorageService } from '../../infrastructure/storage/storage.service';

@Controller('system')
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  @Get('capabilities')
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  capabilities() {
    return systemCapabilities(
      this.storage.defaultLocation.storageProvider,
      this.config,
    );
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

  @Get('storage')
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  storageSpace() {
    return this.storage.space();
  }
}
