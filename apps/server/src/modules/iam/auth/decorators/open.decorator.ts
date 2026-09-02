import { SetMetadata } from '@nestjs/common';

export const IS_OPEN_KEY = 'open';
// 标记未开放接口(无需登录或权限)
export const Open = () => SetMetadata(IS_OPEN_KEY, true);
