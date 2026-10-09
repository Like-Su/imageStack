import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { PermissionCode } from '../../common/constants';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { Open } from '../iam/auth/decorators/open.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import type { RequestUser } from '../iam/auth/auth.type';
import {
  isMediaResponseClosed,
  streamStoredMedia,
} from '../assets/asset-file-response';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { SharesService } from './shares.service';
import {
  createShareSchema,
  shareAssetSchema,
  sharePageSchema,
  shareTargetSchema,
  shareTokenSchema,
  type CreateShareInput,
  type ShareAssetParams,
  type SharePageQuery,
  type ShareTarget,
  type ShareTokenParams,
} from './schemas/shares.schema';

@Controller('shares')
export class SharesController {
  constructor(
    private readonly shares: SharesService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_SHARE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(
    @CurrentUser() user: RequestUser,
    @Body({ schema: createShareSchema }) body: CreateShareInput,
  ) {
    return this.shares.create(user, body);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_SHARE)
  list(
    @CurrentUser() user: RequestUser,
    @Query({ schema: shareTargetSchema }) query: ShareTarget,
  ) {
    return this.shares.list(user.id, query);
  }

  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  revoke(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.shares.revoke(user, id);
  }

  @Get(':token')
  @Open()
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  detail(
    @Param({ schema: shareTokenSchema }) params: ShareTokenParams,
    @Query({ schema: sharePageSchema }) query: SharePageQuery,
  ) {
    return this.shares.detail(params.token, query);
  }

  @Post(':token/save')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  save(
    @CurrentUser() user: RequestUser,
    @Param({ schema: shareTokenSchema }) params: ShareTokenParams,
  ) {
    return this.shares.save(user, params.token);
  }

  @Get(':token/assets/:assetId/thumbnail')
  @Open()
  @SkipResponseWrap()
  thumbnail(
    @Param({ schema: shareAssetSchema }) params: ShareAssetParams,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.media(params, false, request, response);
  }

  @Get(':token/assets/:assetId/file')
  @Open()
  @SkipResponseWrap()
  original(
    @Param({ schema: shareAssetSchema }) params: ShareAssetParams,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.media(params, true, request, response);
  }

  private async media(
    params: ShareAssetParams,
    original: boolean,
    request: Request,
    response: Response,
  ) {
    const resource = await this.shares.media(
      params.token,
      params.assetId,
      original,
    );
    if (isMediaResponseClosed(request, response)) return;
    if ('key' in resource)
      return streamStoredMedia(this.storage, resource, request, response);
    response.status(HttpStatus.ACCEPTED);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Retry-After', '3');
    response.json({
      success: true,
      data: resource,
      timestamp: new Date().toISOString(),
    });
  }
}
