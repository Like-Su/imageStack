import { request } from "./request";
import type {
  AdminPermission,
  AdminRole,
  AdminUser,
  CreateAdminUser,
  SavePermission,
  SaveRole,
  UserPage,
  UserQuery,
} from "@/types/iam";

const identifier = encodeURIComponent;

export const iamApi = {
  users(query: UserQuery, signal?: AbortSignal) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    return request<UserPage>(`/user?${params}`, { signal });
  },
  createUser: (body: CreateAdminUser) =>
    request<AdminUser>("/user", { method: "POST", body }),
  updateUser: (userId: string, body: Partial<CreateAdminUser>) =>
    request<AdminUser>(`/user/${identifier(userId)}`, {
      method: "PATCH",
      body,
    }),
  deleteUser: (userId: string) =>
    request<{ id: string }>(`/user/${identifier(userId)}`, {
      method: "DELETE",
    }),
  roles: (signal?: AbortSignal) => request<AdminRole[]>("/role", { signal }),
  createRole: (body: SaveRole) =>
    request<AdminRole>("/role", { method: "POST", body }),
  updateRole: (roleId: string, body: Partial<SaveRole>) =>
    request<AdminRole>(`/role/${identifier(roleId)}`, {
      method: "PATCH",
      body,
    }),
  deleteRole: (roleId: string) =>
    request<{ id: string }>(`/role/${identifier(roleId)}`, {
      method: "DELETE",
    }),
  permissions: (signal?: AbortSignal) =>
    request<AdminPermission[]>("/permission", { signal }),
  createPermission: (body: SavePermission) =>
    request<PermissionSummaryResult>("/permission", { method: "POST", body }),
  updatePermission: (permissionId: string, body: Partial<SavePermission>) =>
    request<PermissionSummaryResult>(
      `/permission/${identifier(permissionId)}`,
      { method: "PATCH", body },
    ),
  deletePermission: (permissionId: string) =>
    request<{ id: string }>(`/permission/${identifier(permissionId)}`, {
      method: "DELETE",
    }),
};

type PermissionSummaryResult = Pick<
  AdminPermission,
  | "id"
  | "permissionCode"
  | "permissionName"
  | "parentId"
  | "createdAt"
  | "updatedAt"
>;
