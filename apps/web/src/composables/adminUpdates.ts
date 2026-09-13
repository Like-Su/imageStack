import type {
  AdminPermission,
  AdminRecord,
  AdminRole,
  AdminUser,
  PermissionSummary,
  UserPage,
  UserQuery,
} from "@/types/iam";
import type { WorkspaceChange } from "@/types/workspace";

export interface AdminData {
  users: UserPage | null;
  roles: AdminRole[];
  permissions: AdminPermission[];
}

export function updateAdminData(
  data: AdminData,
  change: WorkspaceChange,
  query: UserQuery,
): AdminData {
  if (change.type !== "admin") return data;
  const before = change.before;
  const value = change.value;
  const record = value ?? before;
  if (!record) return data;
  const user = (entry: AdminRecord | null) =>
    entry && "username" in entry ? entry : null;
  const role = (entry: AdminRecord | null) =>
    entry && "roleName" in entry ? entry : null;
  const permission = (entry: AdminRecord | null) =>
    entry && "permissionName" in entry ? entry : null;
  const previousUser = user(before);
  const nextUser = user(value);
  const previousRole = role(before);
  const nextRole = role(value);
  const previousPermission = permission(before);
  const nextPermission = permission(value);
  const replacePermissions = (entries: PermissionSummary[]) =>
    entries.flatMap((entry) =>
      previousPermission?.id === entry.id
        ? nextPermission
          ? [nextPermission]
          : []
        : [entry],
    );
  const difference = (
    id: string,
    previous: PermissionSummary[] = [],
    next: PermissionSummary[] = [],
  ) =>
    Number(next.some((entry) => entry.id === id)) -
    Number(previous.some((entry) => entry.id === id));
  let roles = data.roles.map((entry) => ({
    ...entry,
    userCount: Math.max(
      0,
      entry.userCount +
        Number(nextUser?.roleId === entry.id) -
        Number(previousUser?.roleId === entry.id),
    ),
    permissions: replacePermissions(entry.permissions),
  }));
  if ("roleName" in record) {
    roles = roles.filter((entry) => entry.id !== record.id);
    if (nextRole) roles.push(nextRole);
    roles.sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );
  }
  let permissions = data.permissions.map((entry) => ({
    ...entry,
    userCount: Math.max(
      0,
      entry.userCount +
        difference(
          entry.id,
          previousUser?.directPermissions,
          nextUser?.directPermissions,
        ),
    ),
    roleCount: Math.max(
      0,
      entry.roleCount +
        difference(entry.id, previousRole?.permissions, nextRole?.permissions),
    ),
    childCount: Math.max(
      0,
      entry.childCount +
        Number(nextPermission?.parentId === entry.id) -
        Number(previousPermission?.parentId === entry.id),
    ),
  }));
  if ("permissionName" in record) {
    permissions = permissions.filter((entry) => entry.id !== record.id);
    if (nextPermission) permissions.push(nextPermission);
    permissions.sort(
      (left, right) =>
        left.permissionCode.localeCompare(right.permissionCode) ||
        left.id.localeCompare(right.id),
    );
  }
  let users = data.users;
  if (users && "username" in record) {
    const matches = (entry: AdminUser | null) =>
      Boolean(
        entry &&
        (!query.status || entry.status === query.status) &&
        (!query.roleId || entry.roleId === query.roleId) &&
        (!query.search ||
          [entry.username, entry.email].some((text) =>
            text
              .toLocaleLowerCase()
              .includes(query.search!.toLocaleLowerCase()),
          )),
      );
    const existed = users.items.some((entry) => entry.id === record.id);
    const items = users.items.filter((entry) => entry.id !== record.id);
    if (nextUser && matches(nextUser) && (existed || query.page === 1))
      items.push(nextUser);
    items.sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        right.id.localeCompare(left.id),
    );
    users = {
      ...users,
      items: items.slice(0, query.limit),
      total: Math.max(
        0,
        users.total + Number(matches(nextUser)) - Number(matches(previousUser)),
      ),
    };
  } else if (users) {
    users = {
      ...users,
      items: users.items.map((entry) => {
        const assignedRole =
          nextRole?.id === entry.roleId
            ? nextRole
            : {
                ...entry.role,
                permissions: replacePermissions(entry.role.permissions),
              };
        const directPermissions = replacePermissions(entry.directPermissions);
        const enabled = entry.status === "ACTIVE" && assignedRole.status === 1;
        return {
          ...entry,
          role: assignedRole,
          directPermissions,
          hasAllPermissions: enabled && assignedRole.roleCode === "ROLE_ADMIN",
          effectivePermissionCodes: enabled
            ? [
                ...new Set(
                  [...assignedRole.permissions, ...directPermissions].map(
                    (item) => item.permissionCode,
                  ),
                ),
              ].sort()
            : [],
        };
      }),
    };
  }
  return { roles, permissions, users };
}
