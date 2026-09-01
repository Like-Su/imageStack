import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import type { ApiErrorResponse } from '../types/api-response.type';
import { BusinessException } from '../exceptions/business.exception';

// 捕获全局异常
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: any) {
    const ctx = host.switchToHttp(),
      response: Response = ctx.getResponse(),
      request: Request = ctx.getRequest();

    // 是 HttpException 类型的异常
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const error = this.resolveError(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      code: error.code,
      message: error.message,
      details: error.details ?? {},
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(body);
  }

  private resolveError(exception: unknown, status: number) {
    if (exception instanceof BusinessException) {
      return {
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return {
          code: `HTTP_${status}`,
          message: response,
        };
      }
      const payload = response as Record<string, unknown>;
      const originalMessage = payload.message;
      return {
        code:
          typeof payload.code === 'string' ? payload.code : `HTTP_${status}`,
        message: Array.isArray(originalMessage)
          ? originalMessage.join(', ')
          : String(originalMessage),
        details: Array.isArray(originalMessage)
          ? originalMessage
          : payload.details,
      };
    }

    return {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    };
  }
}
