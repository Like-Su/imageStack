import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../auth.type';

// 获取当前用户信息
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    return ctx.switchToHttp().getRequest<{ user: RequestUser }>().user;
  },
);
