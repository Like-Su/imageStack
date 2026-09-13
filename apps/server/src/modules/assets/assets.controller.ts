import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
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
import { AssetIdsDto } from './dto/asset-ids.dto';
import { RenameAssetDto } from './dto/rename-asset.dto';
import { AssetsService } from './assets.service';
import { AssetWorkspaceService } from './asset-workspace.service';
import { streamStoredMedia } from './asset-file-response';
import type { ThumbnailResponse } from './thumbnails.service';

@Controller('assets')
@RequirePermission(PermissionCode.ASSET_LIST)
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly workspace: AssetWorkspaceService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: RequestUser, @Query() query: ListAssetsDto) {
    return this.assets.list(user.id, query);
  }

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  overview(@CurrentUser() user: RequestUser) {
    return this.workspace.overview(user.id);
  }

  @Get('places')
  @Header('Cache-Control', 'no-store')
  places(@CurrentUser() user: RequestUser) {
    return this.workspace.places(user.id);
  }

  @Delete('trash')
  @RequirePermission(PermissionCode.ASSET_DELETE)
  purge(@CurrentUser() user: RequestUser, @Body() body: AssetIdsDto) {
    return this.workspace.purge(user.id, body.ids);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionCode.ASSET_EDIT)
  retry(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.workspace.retry(assetId, user.id);
  }

  @Get('trash')
  @Header('Cache-Control', 'no-store')
  trash(@CurrentUser() user: RequestUser, @Query() query: ListAssetsDto) {
    return this.assets.list(user.id, query, true);
  }

  @Get('trash/:id')
  @Header('Cache-Control', 'no-store')
  trashDetail(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.assets.detail(assetId, user.id, true);
  }

  @Delete()
  @RequirePermission(PermissionCode.ASSET_DELETE)
  moveToTrash(@CurrentUser() user: RequestUser, @Body() body: AssetIdsDto) {
    return this.assets.moveToTrash(user.id, body.ids);
  }

  @Post('restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionCode.ASSET_DELETE)
  restore(@CurrentUser() user: RequestUser, @Body() body: AssetIdsDto) {
    return this.assets.restore(user.id, body.ids);
  }

  @Get('trash/:id/thumbnail')
  @SkipResponseWrap()
  async trashThumbnail(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ThumbnailQueryDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resource = await this.assets.thumbnail(
      assetId,
      user.id,
      query.size,
      true,
    );

    return this.mediaResponse(resource, request, response);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.assets.detail(assetId, user.id);
  }

  @Patch(':id')
  @RequirePermission(PermissionCode.ASSET_EDIT)
  rename(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: RenameAssetDto,
  ) {
    return this.assets.rename(assetId, user.id, body.name);
  }

  @Post(':id/favorite')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionCode.ASSET_EDIT)
  favorite(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.assets.setFavorite(assetId, user.id, true);
  }

  @Delete(':id/favorite')
  @RequirePermission(PermissionCode.ASSET_EDIT)
  unfavorite(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.assets.setFavorite(assetId, user.id, false);
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

    return this.mediaResponse(resource, request, response);
  }

  @Get(':id/preview')
  @RequirePermission(PermissionCode.ASSET_DOWNLOAD)
  @SkipResponseWrap()
  async preview(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resource = await this.assets.preview(assetId, user.id);
    return this.mediaResponse(resource, request, response);
  }

  private mediaResponse(
    resource: ThumbnailResponse,
    request: Request,
    response: Response,
  ) {
    if ('key' in resource) {
      return streamStoredMedia(this.storage, resource, request, response);
    }

    response.status(HttpStatus.ACCEPTED);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Retry-After', '3');

    return {
      success: true,
      data: resource,
      timestamp: new Date().toISOString(),
    };
  }
}
