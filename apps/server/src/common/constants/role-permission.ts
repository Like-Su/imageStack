// Role
// 角色编码
export const RoleCode = {
  // 管理员
  ADMIN: 'ROLE_ADMIN',
  // 普通用户
  USER: 'ROLE_USER',
} as const;

export type RoleCodeTyoe = (typeof RoleCode)[keyof typeof RoleCode];

// Permission
// 所有权限
export const PermissionCode = {
  // 资源类
  ASSET_CREATE: 'asset:create',
  ASSET_DELETE: 'asset:delete',
  ASSET_EDIT: 'asset:edit',
  ASSET_LIST: 'asset:list',
  ASSET_TAG: 'asset:tag',
  ASSET_CATEGORY: 'asset:category',
  ASSET_SEARCH: 'asset:search',

  // 用户类
  SYSTEM_USER: 'system:user',
  SYSTEM_USER_CREATE: 'system:user:create',
  SYSTEM_USER_DELETE: 'system:user:delete',
  SYSTEM_USER_EDIT: 'system:user:edit',

  // 角色类
  SYSTEM_ROLE: 'system:role',
  SYSTEM_ROLE_CREATE: 'system:role:create',
  SYSTEM_ROLE_DELETE: 'system:role:delete',
  SYSTEM_ROLE_EDIT: 'system:role:edit',

  // 权限类
  SYSTEM_PERMISSION: 'system:permission',
  SYSTEM_PERMISSION_CREATE: 'system:permission:create',
  SYSTEM_PERMISSION_DELETE: 'system:permission:delete',
  SYSTEM_PERMISSION_EDIT: 'system:permission:edit',
} as const;

export const PermissionCodeList = Object.values(PermissionCode);

// export const PermissionCodeList = [
//   // 资源类
//   'asset:create',
//   'asset:delete',
//   'asset:edit',
//   'asset:list',
//   'asset:tag',
//   'asset:category',
//   'asset:search',
//   // 用户类
//   'system:user',
//   'system:user:create',
//   'system:user:delete',
//   'system:user:edit',
//   // 角色
//   'system:role',
//   'system:role:create',
//   'system:role:delete',
//   'system:role:edit',

//   // 权限
//   'system:permission',
//   'system:permission:create',
//   'system:permission:delete',
//   'system:permission:edit',
// ];

// 运行时权限校验
export const RuntimePermissionCode = {
  ASSET_SEARCH: 'asset:search',
} as const;
