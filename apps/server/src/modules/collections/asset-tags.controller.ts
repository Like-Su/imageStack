import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { PermissionCode } from '../../common/constants';
import type { RequestUser } from '../iam/auth/auth.type';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import {
  addAssetTagsSchema,
  type AddAssetTagsInput,
} from './schemas/collections.schema';
import {
  confirmAssetTagsSchema,
  type ConfirmAssetTagsInput,
} from './schemas/confirm-asset-tags.schema';
import { TagsService } from './tags.service';

@Controller('assets')
@RequirePermission(PermissionCode.ASSET_TAG)
export class AssetTagsController {
  constructor(private readonly tags: TagsService) {}

  @Post(':id/tags')
  @HttpCode(HttpStatus.OK)
  addTags(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: addAssetTagsSchema }) body: AddAssetTagsInput,
  ) {
    return this.tags.addToAsset(assetId, user.id, body.names);
  }

  @Post(':id/tags/confirm')
  @HttpCode(HttpStatus.OK)
  confirmTags(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: confirmAssetTagsSchema }) body: ConfirmAssetTagsInput,
  ) {
    return this.tags.confirmForAsset(assetId, user.id, body);
  }

  @Delete(':id/tags/:tagId')
  removeTag(
    @Param('id') assetId: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tags.removeFromAsset(assetId, tagId, user.id);
  }
}
