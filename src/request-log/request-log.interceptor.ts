import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { RequestLogService } from './request-log.service';
import * as requestIp from 'request-ip';
import { RequestLogDto } from './dto/request-log.dto';

@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  @Inject(RequestLogService)
  private readonly requestLogService: RequestLogService;

  private getParams(request: Request): Record<string, any> {
    if (request.method === 'GET') {
      return request.query;
    }

    if (request.method === 'POST') {
      return request.body;
    }

    return {};
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const ctx = context.switchToHttp(),
      response: Response = ctx.getResponse(),
      request: Request = ctx.getRequest(),
      statusCode = response.statusCode,
      userAgent = request.headers['user-agent'],
      ip = request.ip,
      method = request.method,
      url = request.url,
      clientIp = requestIp.getClientIp(ip) || ip,
      errorMessage = request['errorMessage'],
      params = this.getParams(request);

    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;

        const requestLogDto = new RequestLogDto();
        // requestLogDto.userId = request.user;
        console.log(request.user);

        requestLogDto.statusCode = statusCode;
        requestLogDto.userAgent = userAgent;
        requestLogDto.method = method;
        requestLogDto.url = url;
        requestLogDto.ip = clientIp;
        requestLogDto.errorMessage = errorMessage;
        requestLogDto.duration = duration;
        requestLogDto.params = params;

        this.requestLogService.save(requestLogDto);
      }),
    );
  }
}
