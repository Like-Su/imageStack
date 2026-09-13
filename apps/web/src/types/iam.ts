export type AdminSection = "users" | "roles" | "permissions";
export type AccountStatus = "ACTIVE" | "DEACTIVE";

export interface PermissionSummary {
  id: string;
  permissionName: string;
  permissionCode: string;
  parentId: string | null;
}

export interface AdminPermission extends PermissionSummary {
  builtin: boolean;
  roleCount: number;
  userCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRole {
  id: string;
  roleName: string;
  roleCode: string;
  description: string | null;
  status: 0 | 1;
  builtin: boolean;
  userCount: number;
  permissions: PermissionSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  avatar?: string | null;
  status: AccountStatus;
  roleId: string;
  role: Pick<
    AdminRole,
    "id" | "roleName" | "roleCode" | "status" | "permissions"
  >;
  directPermissions: PermissionSummary[];
  hasAllPermissions: boolean;
  effectivePermissionCodes: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export type AdminRecord = AdminUser | AdminRole | AdminPermission;

export interface UserPage {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface UserQuery {
  page: number;
  limit: number;
  search?: string;
  status?: AccountStatus;
  roleId?: string;
}

export interface CreateAdminUser {
  username: string;
  email: string;
  password: string;
  roleId: string;
  status: AccountStatus;
  permissionCodes: string[];
}

export interface SaveRole {
  roleName: string;
  roleCode: string;
  description: string;
  status: 0 | 1;
  permissionCodes: string[];
}

export interface SavePermission {
  permissionName: string;
  permissionCode: string;
  parentId: string | null;
}
