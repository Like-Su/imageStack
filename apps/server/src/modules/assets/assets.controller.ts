import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
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
import { AllowSharedAlbum } from '../iam/auth/decorators/shared-album-access.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { StorageService } from '../../infrastructure/storage/storage.service';
import {
  listAssetsSchema,
  thumbnailQuerySchema,
  trashIdsQuerySchema,
  type ListAssetsQuery,
  type ThumbnailQuery,
  type TrashIdsQuery,
} from './schemas/assets-query.schema';
import { assetIdsSchema, type AssetIdsInput } from './schemas/asset-ids.schema';
import {
  renameAssetSchema,
  type RenameAssetInput,
} from './schemas/rename-asset.schema';
import { AssetsService } from './assets.service';
import { AssetWorkspaceService } from './asset-workspace.service';
import {
  isMediaResponseClosed,
  streamStoredMedia,
} from './asset-file-response';
import type { ThumbnailResponse } from './thumbnails.service';

@Controller('assets')
@RequirePermission(PermissionCode.ASSET_LIST)
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly workspace: AssetWorkspaceService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @AllowSharedAlbum('album-query', 'view')
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: RequestUser,
    @Query({ schema: listAssetsSchema }) query: ListAssetsQuery,
  ) {
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
  purge(
    @CurrentUser() user: RequestUser,
    @Body({ schema: assetIdsSchema }) body: AssetIdsInput,
  ) {
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
  trash(
    @CurrentUser() user: RequestUser,
    @Query({ schema: listAssetsSchema }) query: ListAssetsQuery,
  ) {
    return this.assets.list(user.id, query, true);
  }

  @Get('trash/ids')
  @RequirePermission(PermissionCode.ASSET_DELETE)
  @Header('Cache-Control', 'no-store')
  trashIds(
    @CurrentUser() user: RequestUser,
    @Query({ schema: trashIdsQuerySchema }) query: TrashIdsQuery,
  ) {
    return this.assets.trashIds(user.id, query.cursor);
  }

  @Get('trash/:id')
  @Header('Cache-Control', 'no-store')
  trashDetail(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.assets.detail(assetId, user.id, true);
  }

  @Delete()
  @RequirePermission(PermissionCode.ASSET_DELETE)
  moveToTrash(
    @CurrentUser() user: RequestUser,
    @Body({ schema: assetIdsSchema }) body: AssetIdsInput,
  ) {
    return this.assets.moveToTrash(user.id, body.ids);
  }

  @Post('restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionCode.ASSET_DELETE)
  restore(
    @CurrentUser() user: RequestUser,
    @Body({ schema: assetIdsSchema }) body: AssetIdsInput,
  ) {
    return this.assets.restore(user.id, body.ids);
  }

  @Get('trash/:id/thumbnail')
  @SkipResponseWrap()
  async trashThumbnail(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Query({ schema: thumbnailQuerySchema }) query: ThumbnailQuery,
    @Req() request: Request,
    @Res() response: Response,
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
  @AllowSharedAlbum('asset', 'view')
  @Header('Cache-Control', 'no-store')
  detail(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.assets.detail(assetId, user.id);
  }

  @Patch(':id')
  @RequirePermission(PermissionCode.ASSET_EDIT)
  rename(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: renameAssetSchema }) body: RenameAssetInput,
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
  @AllowSharedAlbum('asset', 'view')
  @RequirePermission(PermissionCode.ASSET_DOWNLOAD)
  @SkipResponseWrap()
  async original(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const resource = await this.assets.original(assetId, user.id);

    return streamStoredMedia(this.storage, resource, request, response);
  }

  @Get(':id/thumbnail')
  @AllowSharedAlbum('asset', 'view')
  @SkipResponseWrap()
  async thumbnail(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Query({ schema: thumbnailQuerySchema }) query: ThumbnailQuery,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const resource = await this.assets.thumbnail(assetId, user.id, query.size);

    return this.mediaResponse(resource, request, response);
  }

  @Get(':id/preview')
  @AllowSharedAlbum('asset', 'view')
  @RequirePermission(PermissionCode.ASSET_DOWNLOAD)
  @SkipResponseWrap()
  async preview(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const resource = await this.assets.preview(assetId, user.id);
    return this.mediaResponse(resource, request, response);
  }

  private mediaResponse(
    resource: ThumbnailResponse,
    request: Request,
    response: Response,
  ) {
    if (isMediaResponseClosed(request, response)) return;
    if ('key' in resource) {
      return streamStoredMedia(this.storage, resource, request, response);
    }

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
