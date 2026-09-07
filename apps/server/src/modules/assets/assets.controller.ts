import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PermissionCode } from '../../common/constants';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import type { RequestUser } from '../iam/auth/auth.type';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { STORAGE_PROVIDER } from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';
import { ListAssetsDto, ThumbnailQueryDto } from './dto/assets-query.dto';
import { AssetsService } from './assets.service';
import { streamStoredMedia } from './asset-file-response';

@Controller('assets')
@RequirePermission(PermissionCode.ASSET_LIST)
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: RequestUser, @Query() query: ListAssetsDto) {
    return this.assets.list(user.id, query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.assets.detail(assetId, user.id);
  }

  @Get(':id/file')
  @RequirePermission(PermissionCode.ASSET_DOWNLOAD)
  @SkipResponseWrap()
  async original(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resource = await this.assets.original(assetId, user.id);

    return streamStoredMedia(this.storage, resource, request, response);
  }

  @Get(':id/thumbnail')
  @SkipResponseWrap()
  async thumbnail(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ThumbnailQueryDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resource = await this.assets.thumbnail(assetId, user.id, query.size);

    return streamStoredMedia(this.storage, resource, request, response);
  }
}
