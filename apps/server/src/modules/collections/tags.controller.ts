import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PermissionCode } from '../../common/constants';
import type { RequestUser } from '../iam/auth/auth.type';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { CreateTagDto, UpdateTagDto } from './dto/collections.dto';
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
  create(@CurrentUser() user: RequestUser, @Body() body: CreateTagDto) {
    return this.tags.create(user.id, body);
  }

  @Patch(':id')
  update(
    @Param('id') tagId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateTagDto,
  ) {
    return this.tags.update(tagId, user.id, body);
  }

  @Delete(':id')
  remove(@Param('id') tagId: string, @CurrentUser() user: RequestUser) {
    return this.tags.remove(tagId, user.id);
  }
}
