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
} from '@nestjs/common';
import { PermissionCode, RoleCode } from '../../common/constants';
import {
  cursorPaginationSchema,
  type CursorPagination,
} from '../../common/schemas/cursor-pagination.schema';
import {
  assetIdsSchema,
  type AssetIdsInput,
} from '../assets/schemas/asset-ids.schema';
import {
  renameAssetSchema,
  type RenameAssetInput,
} from '../assets/schemas/rename-asset.schema';
import type { RequestUser } from '../iam/auth/auth.type';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { AllowSharedAlbum } from '../iam/auth/decorators/shared-album-access.decorator';
import {
  RequirePermission,
  RequireRole,
} from '../iam/auth/decorators/roles-permissions.decorator';
import { AlbumsService } from './albums.service';
import {
  createAlbumSchema,
  updateAlbumSchema,
  type CreateAlbumInput,
  type UpdateAlbumInput,
} from './schemas/collections.schema';
import {
  albumMemberPermissionsSchema,
  inviteAlbumMemberSchema,
  type AlbumMemberPermissionsInput,
  type InviteAlbumMemberInput,
} from './schemas/album-members.schema';

@Controller('albums')
@RequirePermission(PermissionCode.ASSET_CATEGORY)
export class AlbumsController {
  constructor(private readonly albums: AlbumsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  list(@CurrentUser() user: RequestUser) {
    return this.albums.list(user.id);
  }

  @Get(':id')
  @AllowSharedAlbum('album', 'view')
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  detail(
    @Param('id') albumId: string,
    @CurrentUser() user: RequestUser,
    @Query({ schema: cursorPaginationSchema }) query: CursorPagination,
  ) {
    return this.albums.detail(albumId, user.id, query);
  }

  @Get(':id/summary')
  @AllowSharedAlbum('album', 'view')
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  summary(@Param('id') albumId: string, @CurrentUser() user: RequestUser) {
    return this.albums.getSummary(albumId, user.id);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body({ schema: createAlbumSchema }) body: CreateAlbumInput,
  ) {
    return this.albums.create(user, body);
  }

  @Patch(':id')
  @AllowSharedAlbum('album', 'edit')
  update(
    @Param('id') albumId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: updateAlbumSchema }) body: UpdateAlbumInput,
  ) {
    return this.albums.update(albumId, user.id, body);
  }

  @Delete(':id')
  @AllowSharedAlbum('album', 'deleteAlbum')
  remove(@Param('id') albumId: string, @CurrentUser() user: RequestUser) {
    return this.albums.remove(albumId, user.id);
  }

  @Post(':id/assets')
  @AllowSharedAlbum('album', 'addAssets')
  @HttpCode(HttpStatus.OK)
  addAssets(
    @Param('id') albumId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: assetIdsSchema }) body: AssetIdsInput,
  ) {
    return this.albums.addAssets(albumId, user.id, body.ids);
  }

  @Delete(':id/assets')
  @AllowSharedAlbum('album', 'removeAssets')
  removeAssets(
    @Param('id') albumId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: assetIdsSchema }) body: AssetIdsInput,
  ) {
    return this.albums.removeAssets(albumId, user.id, body.ids);
  }

  @Patch(':id/assets/:assetId')
  @AllowSharedAlbum('album', 'edit')
  @RequirePermission(PermissionCode.ASSET_EDIT)
  renameAsset(
    @Param('id') albumId: string,
    @Param('assetId') assetId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: renameAssetSchema }) body: RenameAssetInput,
  ) {
    return this.albums.renameAsset(albumId, assetId, user.id, body.name);
  }

  @Get(':id/members')
  @Header('Cache-Control', 'no-store')
  @RequireRole(RoleCode.ADMIN)
  members(@Param('id') albumId: string, @CurrentUser() user: RequestUser) {
    return this.albums.listMembers(albumId, user.id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  @RequireRole(RoleCode.ADMIN)
  inviteMember(
    @Param('id') albumId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: inviteAlbumMemberSchema }) body: InviteAlbumMemberInput,
  ) {
    return this.albums.inviteMember(albumId, user.id, body);
  }

  @Patch(':id/members/:userId')
  @RequireRole(RoleCode.ADMIN)
  updateMember(
    @Param('id') albumId: string,
    @Param('userId') memberId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: albumMemberPermissionsSchema })
    body: AlbumMemberPermissionsInput,
  ) {
    return this.albums.updateMember(albumId, user.id, memberId, body);
  }

  @Delete(':id/members/:userId')
  @RequireRole(RoleCode.ADMIN)
  removeMember(
    @Param('id') albumId: string,
    @Param('userId') memberId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.albums.removeMember(albumId, user.id, memberId);
  }
}
