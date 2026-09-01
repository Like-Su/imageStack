import { HttpException, HttpStatus } from '@nestjs/common';

// 公共异常类，用于处理业务逻辑中的异常情况
export class BusinessException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        code,
        message,
        details,
      },
      status,
    );
  }
}
