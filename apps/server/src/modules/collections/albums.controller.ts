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
import { PermissionCode } from '../../common/constants';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { AssetIdsDto } from '../assets/dto/asset-ids.dto';
import type { RequestUser } from '../iam/auth/auth.type';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { AlbumsService } from './albums.service';
import { CreateAlbumDto, UpdateAlbumDto } from './dto/collections.dto';

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
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  detail(
    @Param('id') albumId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: CursorPaginationDto,
  ) {
    return this.albums.detail(albumId, user.id, query);
  }

  @Get(':id/summary')
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  summary(@Param('id') albumId: string, @CurrentUser() user: RequestUser) {
    return this.albums.getSummary(albumId, user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() body: CreateAlbumDto) {
    return this.albums.create(user.id, body);
  }

  @Patch(':id')
  update(
    @Param('id') albumId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateAlbumDto,
  ) {
    return this.albums.update(albumId, user.id, body);
  }

  @Delete(':id')
  remove(@Param('id') albumId: string, @CurrentUser() user: RequestUser) {
    return this.albums.remove(albumId, user.id);
  }

  @Post(':id/assets')
  @HttpCode(HttpStatus.OK)
  addAssets(
    @Param('id') albumId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: AssetIdsDto,
  ) {
    return this.albums.addAssets(albumId, user.id, body.ids);
  }

  @Delete(':id/assets')
  removeAssets(
    @Param('id') albumId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: AssetIdsDto,
  ) {
    return this.albums.removeAssets(albumId, user.id, body.ids);
  }
}
