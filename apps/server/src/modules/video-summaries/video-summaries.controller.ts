import {
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { PermissionCode } from '../../common/constants';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import type { RequestUser } from '../iam/auth/auth.type';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { VideoSummariesService } from './video-summaries.service';
import { VideoSummaryEventsService } from './video-summary-events.service';

@Controller('video-summaries')
export class VideoSummariesController {
  constructor(
    private readonly summaries: VideoSummariesService,
    private readonly events: VideoSummaryEventsService,
  ) {}

  @Sse('events')
  @SkipResponseWrap()
  @Header('Cache-Control', 'no-store')
  @Header('X-Accel-Buffering', 'no')
  @RequirePermission(PermissionCode.ASSET_LIST)
  stream(
    @CurrentUser() user: RequestUser,
    @Query('after') after?: string,
    @Headers('last-event-id') lastEventId?: string,
  ) {
    return this.events.stream(user, after ?? lastEventId);
  }

  @Get('assets/:id')
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  detail(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.summaries.detail(assetId, user.id);
  }

  @Post('assets/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PermissionCode.ASSET_EDIT)
  enqueue(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.summaries.enqueue(assetId, user.id);
  }
}
