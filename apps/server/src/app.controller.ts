import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { BusinessException } from './common/exceptions/business.exception';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('error')
  // error 测试
  getError(): string {
    throw new BusinessException(
      'BUSINESS_ERROR',
      'This is a business exception',
      { info: 'Additional details' },
    );
  }

  @Get('unknown-error')
  // 未知错误测试
  getUnknownError(): string {
    throw new Error('This is an unknown error');
  }

  @Get('success')
  // 成功测试
  getSuccess(): string {
    return 'success';
  }
}
