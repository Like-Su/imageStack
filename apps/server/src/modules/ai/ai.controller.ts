import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { PermissionCode } from '../../common/constants';
import type { RequestUser } from '../iam/auth/auth.type';
import { CurrentUser } from '../iam/auth/decorators/current-user.decorator';
import { RequirePermission } from '../iam/auth/decorators/roles-permissions.decorator';
import { AiIndexService } from './ai-index.service';
import { QueueRecognitionDto } from './dto/queue-recognition.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly index: AiIndexService) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_SEARCH)
  status(@CurrentUser() user: RequestUser) {
    return this.index.status(user.id);
  }

  @Get('assets/:id')
  @Header('Cache-Control', 'no-store')
  @RequirePermission(PermissionCode.ASSET_LIST)
  detail(@Param('id') assetId: string, @CurrentUser() user: RequestUser) {
    return this.index.detail(assetId, user.id);
  }

  @Post('index')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PermissionCode.ASSET_EDIT)
  enqueue(@CurrentUser() user: RequestUser, @Body() dto: QueueRecognitionDto) {
    return this.index.enqueue(user.id, dto.ids);
  }
}
