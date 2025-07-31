import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
export const UserInfo = createParamDecorator(
  (key: string, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();

    if (!request.user) {
      return null;
    }

    return key ? request.user[key] : request.user;
  },
);
