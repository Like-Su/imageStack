import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PermissionCode } from '../../common/constants';
import type { RequestUser } from '../iam/auth/auth.type';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { CreateUploadSessionDto } from './dto/upload.dto';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@RequirePermission(PermissionCode.UPLOAD_CREATE)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('sessions')
  createSession(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateUploadSessionDto,
  ) {
    return this.uploadsService.createSession(user.id, dto);
  }

  @Get('sessions/:id')
  getSession(@Param('id') sessionId: string, @CurrentUser() user: RequestUser) {
    return this.uploadsService.getSession(sessionId, user.id);
  }

  @Put('sessions/:id/content')
  async uploadContent(
    @Param('id') sessionId: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    try {
      return await this.uploadsService.uploadContent(
        sessionId,
        user.id,
        request,
      );
    } finally {
      if (!request.destroyed && !request.readableEnded) {
        request.resume();
      }
    }
  }
}
