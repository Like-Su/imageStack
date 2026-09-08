import { Controller, Get, Header, Query } from '@nestjs/common';
import { PermissionCode } from '../../common/constants';
import type { RequestUser } from '../iam/auth/auth.type';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@Controller('search')
@RequirePermission(PermissionCode.ASSET_SEARCH)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  search(@CurrentUser() user: RequestUser, @Query() query: SearchQueryDto) {
    return this.searchService.search(user.id, query);
  }
}
