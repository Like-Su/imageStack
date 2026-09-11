import {
  Body,
  Controller,
  Get,
  Inject,
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
import { STORAGE_PROVIDER } from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';
import { MediaStreamDto } from './dto/media-stream.dto';
import { MediaStreamService } from './media-stream.service';
import { streamStoredMedia } from './asset-file-response';

@Controller('assets')
export class MediaStreamController {
  constructor(
    private readonly streams: MediaStreamService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
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
    @Res({ passthrough: true }) response: Response,
  ) {
    const resource = await this.streams.resource(assetId, fileName, ticket);
    response.setHeader('Referrer-Policy', 'no-referrer');
    if ('playlist' in resource) {
      response.setHeader(
        'Content-Type',
        'application/vnd.apple.mpegurl; charset=utf-8',
      );
      response.setHeader('Cache-Control', 'private, no-store');
      return resource.playlist;
    }
    return streamStoredMedia(this.storage, resource, request, response);
  }
}
