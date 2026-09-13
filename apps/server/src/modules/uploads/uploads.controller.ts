import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
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

  @Get('sessions/:id/progress')
  getProgress(
    @Param('id') sessionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploadsService.getProgress(sessionId, user.id);
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

  @Put('sessions/:id/parts/:index')
  async uploadPart(
    @Param('id') sessionId: string,
    @Param('index', ParseIntPipe) index: number,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    try {
      return await this.uploadsService.uploadPart(
        sessionId,
        user.id,
        index,
        request,
      );
    } finally {
      if (!request.destroyed && !request.readableEnded) request.resume();
    }
  }

  @Post('sessions/:id/complete')
  complete(@Param('id') sessionId: string, @CurrentUser() user: RequestUser) {
    return this.uploadsService.complete(sessionId, user.id);
  }

  @Delete('sessions/:id')
  cancel(@Param('id') sessionId: string, @CurrentUser() user: RequestUser) {
    return this.uploadsService.cancel(sessionId, user.id);
  }
}
