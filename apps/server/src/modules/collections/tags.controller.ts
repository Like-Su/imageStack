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
} from '@nestjs/common';
import { PermissionCode } from '../../common/constants';
import type { RequestUser } from '../iam/auth/auth.type';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import {
  batchAssetTagsSchema,
  createTagSchema,
  updateTagSchema,
  type BatchAssetTagsInput,
  type CreateTagInput,
  type UpdateTagInput,
} from './schemas/collections.schema';
import {
  assetIdsSchema,
  type AssetIdsInput,
} from '../assets/schemas/asset-ids.schema';
import { TagsService } from './tags.service';

@Controller('tags')
@RequirePermission(PermissionCode.ASSET_TAG)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  list(@CurrentUser() user: RequestUser) {
    return this.tags.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body({ schema: createTagSchema }) body: CreateTagInput,
  ) {
    return this.tags.create(user.id, body);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  detail(@Param('id') tagId: string, @CurrentUser() user: RequestUser) {
    return this.tags.detail(tagId, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') tagId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: updateTagSchema }) body: UpdateTagInput,
  ) {
    return this.tags.update(tagId, user.id, body);
  }

  @Post('assets')
  @HttpCode(HttpStatus.OK)
  addAssets(
    @CurrentUser() user: RequestUser,
    @Body({ schema: batchAssetTagsSchema }) body: BatchAssetTagsInput,
  ) {
    return this.tags.addToAssets(body.ids, user.id, body.names);
  }

  @Delete(':id/assets')
  removeAssets(
    @Param('id') tagId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: assetIdsSchema }) body: AssetIdsInput,
  ) {
    return this.tags.removeFromAssets(body.ids, tagId, user.id);
  }

  @Delete(':id')
  remove(@Param('id') tagId: string, @CurrentUser() user: RequestUser) {
    return this.tags.remove(tagId, user.id);
  }
}
