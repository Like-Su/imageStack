# 用户、角色与权限管理

## 管理入口

使用启用的管理员账户登录后，从侧栏「访问管理」进入：

- `/admin/users`：创建、搜索、编辑、停用或删除用户，分配角色及用户额外权限。
- `/admin/roles`：创建、编辑、停用或删除自定义角色，管理角色权限。
- `/admin/permissions`：创建、编辑或删除自定义权限，维护父子层级。

用户与角色的「编辑与授权」按钮同时提供资料和授权编辑。用户编辑窗口展示角色继承权限和生效权限预览；用户列表区分额外权限与实际生效权限，管理员显示「全部」，停用的账户或角色显示「未生效」。

## 授权规则

- 沿用单角色模型，每个用户关联一个角色。普通用户的权限为角色权限与用户额外权限的去重并集；清空额外权限不会撤销角色继承的权限。
- `ROLE_ADMIN` 始终拥有全部操作权限。普通用户即使获得 `system:` 系列权限，也不能调用管理员管理接口；前端路由和服务端鉴权分别限制管理访问。
- 账户或角色停用后不能登录，所有授权均不生效。管理员创建的账户默认启用，无需激活邮件；管理员修改或删除账户后，旧激活链接不能重新启用该账户。
- 父子权限只表示组织层级，不会隐式授予子权限，不允许自引用或循环。自定义权限编码需要业务接口显式校验才会控制实际操作，资源所有权限制保持不变。
- 内置角色及权限允许修改显示名称，但不能删除或更改编码；管理员角色不能停用。禁止管理员删除或停用自己、撤销自己的管理员角色，系统必须保留至少一名启用的管理员。
- 删除用户为软删除，保留媒体与邮箱占用。角色有关联未删除用户时应先转移用户再删除；删除权限前应先删除或移动子权限，其角色及用户授权会随删除一并移除。
- 用户、角色修改及权限编码修改、权限删除会递增受影响账户的 `sessionVersion`，旧访问令牌、刷新令牌及激活链接失效，相关用户需要重新登录。授权缓存按会话版本隔离，所有管理写入在可串行化事务中再次校验管理员并记录不含密码的审计日志。

## API 契约

路径相对于服务端 `API_PREFIX`（默认 `/api`），不额外添加 `/v1`。请求需携带 `Authorization: Bearer <accessToken>`，写请求复用已有 CSRF 防护。除 `POST /user/me` 外，以下接口仅允许启用的 `ROLE_ADMIN` 账户访问。成功响应为 `{ success: true, data, timestamp }`，下表描述 `data`。

| Method | Path                    | 请求与返回                                                                                                     |
| ------ | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| POST   | `/user/me`              | 返回当前登录用户及角色、权限编码；所有已登录用户可用                                                           |
| GET    | `/user`                 | `?page=1&limit=20`，可选 `search`、`status`、`roleId` 筛选 → `{ items, total, page, limit }`，`limit` 最大 100 |
| POST   | `/user`                 | `{ username, email, password, roleId?, status?, permissionCodes? }` → 用户摘要                                 |
| PATCH  | `/user/:id`             | 部分更新用户名、邮箱、密码、角色、状态或额外权限 → 用户摘要                                                    |
| PATCH  | `/user/:id/permissions` | `{ permissionCodes: [] }`，替换用户直接授权，不影响角色继承权限 → 用户摘要                                     |
| DELETE | `/user/:id`             | 软删除、停用并撤销登录 → `{ id }`                                                                              |
| GET    | `/role`                 | 返回角色数组，包含 `permissions`、`userCount` 与 `builtin`                                                     |
| POST   | `/role`                 | `{ roleName, roleCode, description?, status?, permissionCodes? }` → 角色摘要                                   |
| PATCH  | `/role/:id`             | 部分更新角色名称、编码、说明、状态或权限 → 角色摘要                                                            |
| GET    | `/role/:id/permissions` | 返回该角色摘要及其权限列表                                                                                     |
| PATCH  | `/role/:id/permissions` | `{ permissionCodes: [] }`，替换角色权限 → 角色摘要                                                             |
| DELETE | `/role/:id`             | 删除没有关联未删除用户的自定义角色 → `{ id }`                                                                  |
| GET    | `/permission`           | 返回权限数组，包含 `parentId`、`builtin`、`roleCount`、`userCount`、`childCount`                               |
| POST   | `/permission`           | `{ permissionName, permissionCode, parentId? }` → 权限记录                                                     |
| PATCH  | `/permission/:id`       | 部分更新权限名称、编码或父级，`parentId: null` 移至根级 → 权限记录                                             |
| DELETE | `/permission/:id`       | 删除无子项的自定义权限并移除角色及用户授权 → `{ id }`                                                          |

### 字段约定

- 用户创建时 `roleId` 不传使用 `ROLE_USER`；`status` 为 `ACTIVE`（默认启用）或 `DEACTIVE`（停用）。密码至少 8 位且 UTF-8 不超过 72 字节，修改时省略密码表示保持不变，接口不返回密码或其哈希。
- 用户摘要包含 `role`、`directPermissions`、`effectivePermissionCodes` 和 `hasAllPermissions`。账户或角色停用时生效编码为空；启用的管理员以 `hasAllPermissions: true` 表示全部操作权限，不限于摘要中列出的授权编码。
- 用户名、角色名、权限名最长 80 字符，角色说明最长 500 字符，编码最长 100 字符。角色编码格式为 `ROLE_[A-Z][A-Z0-9_]*`；权限编码为小写冒号分段格式，例如 `asset:list`、`plugin:export`。
- 角色状态使用 `1`（启用，默认）或 `0`（停用）。`permissionCodes` 最多 500 个已存在且不重复的编码；PATCH 时省略该字段保持原授权，空数组清空对应的直接授权。
- 名称、邮箱或编码重复，记录不存在、非法父级或试图删除受保护记录时，服务端返回对应错误，前端保留编辑内容并展示提示。
- 兼容 `POST /user/create`、`POST /user/delete`（请求 `{ id }`）及 `GET /user/list-users`；列表别名采用上述页码分页结构。

## 部署

已有环境在启动新版服务前执行：

```bash
pnpm --dir apps/server db:migrate
pnpm --dir apps/server db:generate
```

迁移 `20260911200000_iam_user_permissions` 创建用户直接授权关联表及外键、索引，并移除角色说明的唯一约束；不改变已有用户、角色和默认授权。全新环境通过 `pnpm db:init` 初始化数据库、内置角色、权限和管理员，随后执行 `pnpm --dir apps/server db:generate`。

管理员初始化使用既有 `ADMIN_EMAIL`、`ADMIN_PASSWORD` 或 `ADMIN_PASSWORD_HASH` 配置，不提供通用默认密码，详见 `apps/server/README.md`。
