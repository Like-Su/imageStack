import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs/operators';

// Custom
import { SKIP_RESPONSE_WRAP } from '../decorators/skip-response-wrap.decorator';

// type
import type { ApiSuccessResponse } from '../types/api-response.type';
import type { Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T> | T> {
    // 是否跳过转换
    const shouldSkip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_WRAP,
      [context.getHandler(), context.getClass()],
    );

    if (shouldSkip) return next.handle();

    return next.handle().pipe(
      map((data: T) => {
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
