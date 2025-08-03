import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';

@Injectable()
export class BuildResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response: Response = context.switchToHttp().getResponse();

    // 将返回结果 构建为 一个 格式化对象返回
    return next.handle().pipe(
      map((data) => {
        // 若 data 为 文件流则直接给 客户端下载
        if(data instanceof StreamableFile) return data;

        // 测试
        if (data && data._type === 'application/html') {
          return data.data;
        }

        // 构建打包结果
        return {
          code: response.statusCode,
          message: 'success',
          data,
        };
      }),
    );
  }
}
