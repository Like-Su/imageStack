import {
  Body,
  Controller,
  Get,
  Param,
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
import { Open } from '../iam/auth/decorators/open.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { StorageService } from '../storage/storage.service';
import { MediaStreamDto } from './dto/media-stream.dto';
import { MediaStreamService } from './media-stream.service';
import {
  isMediaResponseClosed,
  streamStoredMedia,
} from './asset-file-response';

@Controller('assets')
export class MediaStreamController {
  constructor(
    private readonly streams: MediaStreamService,
    private readonly storage: StorageService,
  ) {}

  @Post(':id/stream-ticket')
  @RequirePermission(PermissionCode.ASSET_DOWNLOAD)
  ticket(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: MediaStreamDto,
  ) {
    return this.streams.createTicket(assetId, user, dto.kind);
  }

  @Get(':id/stream/:fileName')
  @Open()
  @SkipResponseWrap()
  async stream(
    @Param('id') assetId: string,
    @Param('fileName') fileName: string,
    @Query('ticket') ticket: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const resource = await this.streams.resource(assetId, fileName, ticket);
    if (isMediaResponseClosed(request, response)) return;
    response.setHeader('Referrer-Policy', 'no-referrer');
    if ('playlist' in resource) {
      response.setHeader(
        'Content-Type',
        'application/vnd.apple.mpegurl; charset=utf-8',
      );
      response.setHeader('Cache-Control', 'private, no-store');
      response.send(resource.playlist);
      return;
    }
    return streamStoredMedia(this.storage, resource, request, response);
  }
}
