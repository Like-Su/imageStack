import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { AllowSharedAlbum } from '../iam/auth/decorators/shared-album-access.decorator';
import { Open } from '../iam/auth/decorators/open.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { StorageService } from '../../infrastructure/storage/storage.service';
import {
  mediaStreamSchema,
  type MediaStreamInput,
} from './schemas/media-stream.schema';
import { MediaStreamService } from './media-stream.service';
import { AssetDownloadsService } from './asset-downloads.service';
import { assetIdsSchema, type AssetIdsInput } from './schemas/asset-ids.schema';
import {
  isMediaResponseClosed,
  streamStoredMedia,
} from './asset-file-response';

@Controller('assets')
export class MediaStreamController {
  constructor(
    private readonly streams: MediaStreamService,
    private readonly storage: StorageService,
    private readonly downloads: AssetDownloadsService,
  ) {}

  @Post('downloads/archive-ticket')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionCode.ASSET_DOWNLOAD)
  archiveTicket(
    @CurrentUser() user: RequestUser,
    @Body({ schema: assetIdsSchema }) dto: AssetIdsInput,
  ) {
    return this.downloads.createTicket(dto.ids, user);
  }

  @Get('downloads/archive')
  @Open()
  @SkipResponseWrap()
  archive(
    @Query('ticket') ticket: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.downloads.stream(ticket, request, response);
  }

  @Post(':id/stream-ticket')
  @AllowSharedAlbum('asset', 'view')
  @RequirePermission(PermissionCode.ASSET_DOWNLOAD)
  ticket(
    @Param('id') assetId: string,
    @CurrentUser() user: RequestUser,
    @Body({ schema: mediaStreamSchema }) dto: MediaStreamInput,
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
