import { SetMetadata } from '@nestjs/common';
import { UN_NEED_LOGIN, NEED_PERMISSIONS, PERMISSIONS } from './constants';

export const UnNeedLogin = () => SetMetadata(UN_NEED_LOGIN, true);

export const NeedPermissions = (...permissions: PERMISSIONS[]) =>
  SetMetadata(NEED_PERMISSIONS, permissions);
