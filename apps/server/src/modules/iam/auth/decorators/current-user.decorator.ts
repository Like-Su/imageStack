import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../auth.type';

// 获取当前用户信息
export const CurrentUser = createParamDecorator(
  (_data, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<{ user: User }>();
    return request.user;
  },
);
