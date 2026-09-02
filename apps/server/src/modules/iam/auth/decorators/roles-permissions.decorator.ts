import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'ROLES';
export const RequireRole = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'PERMISSIONS';
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
