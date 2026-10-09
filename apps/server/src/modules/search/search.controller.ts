import { Controller, Get, Header, Query } from '@nestjs/common';
import { PermissionCode } from '../../common/constants';
import type { RequestUser } from '../iam/auth/auth.type';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import {
  searchQuerySchema,
  type SearchQuery,
} from './schemas/search-query.schema';
import { SearchService } from './search.service';

@Controller('search')
@RequirePermission(PermissionCode.ASSET_SEARCH)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  search(
    @CurrentUser() user: RequestUser,
    @Query({ schema: searchQuerySchema }) query: SearchQuery,
  ) {
    return this.searchService.search(user.id, query);
  }
}
