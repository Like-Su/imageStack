# 项目架构说明

## M4：收藏、回收站、手动相册与标签

本阶段在 M3 资产接口上实现后端数据库 CRUD，继续使用 `FileNode`，新增
`Album`、`AlbumAsset`、`Tag`、`AssetTag`。不包含前端页面、AI 建议、智能相册、
物理文件删除或定时清空回收站。

### 更新数据库

在 `apps/server` 中配置好 `.env` 的 `DATABASE_URL` 后执行：

```bash
pnpm exec prisma migrate deploy --config prisma7.config.ts
pnpm exec prisma generate --config prisma7.config.ts
```

新增迁移 `20260908100000_m4_manual_collections` 仅添加集合表、外键和索引，
不清空既有数据。数据库迁移需要在启动新版本服务前应用。

### 接口

以下路径使用配置的 `API_PREFIX`（默认 `/api`），要求现有 JWT 鉴权。
JSON 响应沿用 `{ success, data, timestamp }`。

| 方法           | 路径                                  | 用途                                                                    |
| -------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| GET            | `/assets?favorite=true`               | 收藏列表；也支持 `favorite=false`、`albumId`、`tagId`、精确标签名 `tag` |
| POST / DELETE  | `/assets/:id/favorite`                | 收藏 / 取消收藏，返回 `{ id, isFavorite }`                              |
| DELETE         | `/assets`                             | `{ ids }` 批量移入回收站                                                |
| GET            | `/assets/trash`                       | 回收站，支持与图库相同的分页和筛选                                      |
| POST           | `/assets/restore`                     | `{ ids }` 批量恢复                                                      |
| GET            | `/assets/trash/:id/thumbnail?size=sm` | 回收站缩略图，复用 M3 按需生成逻辑                                      |
| GET / POST     | `/albums`                             | 相册数组 / 新建 `{ name, description? }`                                |
| GET            | `/albums/:id?cursor&limit`            | 相册信息和 `assets: { items, nextCursor, hasMore }`                     |
| PATCH / DELETE | `/albums/:id`                         | 更新 `{ name?, description?, coverAssetId? }` / 删除相册                |
| POST / DELETE  | `/albums/:id/assets`                  | `{ ids }` 添加 / 移出相册成员                                           |
| GET / POST     | `/tags`                               | 手动标签云 / 新建 `{ name }`                                            |
| PATCH / DELETE | `/tags/:id`                           | 改名 `{ name }` 或手动合并 `{ mergeIntoId }` / 删除标签                 |
| POST           | `/assets/:id/tags`                    | `{ names }` 自动创建并关联当前用户的手动标签                            |
| DELETE         | `/assets/:id/tags/:tagId`             | 仅解除该资产与标签的关联                                                |

资产分页默认 `limit=24`，范围为 1～100，按 `createdAt DESC, id DESC` 排序。
切换视图或筛选条件时清空 `cursor`；`favorite` 只接受 `true` / `false`。
列表增加 `deleted`、`deletedAt` 和 `tags: { id, name, source: "MANUAL" }[]`；
详情另外返回 `albums: { id, name }[]`。

### 一致性与权限

- 所有资源按当前用户隔离，包括管理员；他人资源与不存在的资源均返回 404。
- 批量 `{ ids }` 接受 1～100 个不重复 ID；整个批次先校验，再在可重试的串行化事务中写入。
  只要存在无效或他人 ID，整批回滚。回收/恢复、添加/移出相册返回 `{ count }`，表示实际变化数。
- 收藏、回收/恢复和关联添加/移除可重复执行；重复回收不会改变首次删除时间。
  回收不删除原图、缩略图、收藏或集合关系；恢复重新显示这些关系。
- 回收站资产不出现在普通图库、收藏、相册成员及标签计数中；普通详情、原图和缩略图接口返回 404。
  仅专用回收站缩略图接口允许预览；回收站资产不能新加相册、标签或修改收藏。
- 相册/标签名去除首尾空白后在同一用户内区分大小写且唯一，重复创建或重命名返回 409。
  相册名上限 200 字符、标签名上限 100 字符；相册描述上限 2000 字符；`names` 每次为 1～50 项。
- 相册封面必须是其中未删除的成员；没有显式封面或封面已回收时使用最新可见成员。
  `coverAssetId: null` 恢复自动封面，`description: null` 清空描述；移出封面成员会清除显式选择。
- 删除相册或标签只删除集合与关联，不删除资产。手动合并标签会去重并保留所有关联（包括回收站）。
  用户主动删除或合并的集合不会因资产恢复而重建。
- 读取要求 `asset:list`；收藏要求 `asset:edit`；回收/恢复要求 `asset:delete`；
  相册写入要求 `asset:category`；标签写入要求 `asset:tag`。
  初始化脚本仍为 `ROLE_USER` 保留只读/搜索权限；写接口须由管理员授予相应权限，本阶段不自动扩权。

## 目录设计

apps/server/src/
├── app.module.ts
│
├── common/
│ ├── decorators/
│ ├── filters/
│ ├── guards/
│ ├── interceptors/
│ ├── pipes/
│ └── types/
│
├── infrastructure/
│ ├── database/
│ ├── queue/
│ ├── storage/
│ ├── config/
│ └── events/
│
└── modules/
├── iam/
├── assets/
├── uploads/
├── search/
├── collections/
├── jobs/
├── ai/
├── libraries/
├── plugins/
└── system/

## 模块职责

模块 主要职责
━━━━━━━━━━━━━━━━━━━ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IamModule 登录、注册、Token、用户、角色、权限、OIDC/LDAP
─────────────────── ─────────────────────────────────────────────────────
AssetsModule 媒体资产 CRUD、元数据、详情、收藏、回收站
─────────────────── ─────────────────────────────────────────────────────
UploadsModule 分片上传、断点续传、秒传、上传会话
─────────────────── ─────────────────────────────────────────────────────
SearchModule 文件名/OCR/标签/向量/结构化条件的组合搜索
─────────────────── ─────────────────────────────────────────────────────
CollectionsModule 相册、智能相册、标签、收藏集
─────────────────── ─────────────────────────────────────────────────────
JobsModule BullMQ 任务查询、暂停、恢复、重试、取消、SSE 推送
─────────────────── ─────────────────────────────────────────────────────
AiModule OCR、Embedding、Caption、检测等 Provider 注册与调用
─────────────────── ─────────────────────────────────────────────────────
LibrariesModule 文件夹扫描、NAS 目录导入、增量扫描
─────────────────── ─────────────────────────────────────────────────────
PluginsModule 插件清单、启停、配置、生命周期
─────────────────── ─────────────────────────────────────────────────────
SystemModule 健康检查、系统设置、存储统计、版本信息

IamModule/
├── auth/
├── users/
├── roles/
├── permissions/
└── policies/

不要把所有授权判断都散落在 UsersService 中。

推荐职责：

- AuthModule
  - 注册
  - 登录
  - access token
  - refresh token
  - OIDC/LDAP

- UsersModule
  - 用户资料
  - 偏好设置
  - 用户状态

- RolesModule
  - 角色
  - 权限集合
  - 用户角色绑定

- Policies
  - 当前用户是否可以读取某个 Asset
  - 当前用户是否可以删除某个 Album
  - 当前用户是否可以管理插件

动作资源格式
asset.read
asset.create
asset.update
asset.delete
asset.download

album.read
album.write

upload.create
upload.cancel

job.read
job.control

plugin.read
plugin.manage
system.manage

Nest 层面通常是：

JwtAuthGuard
↓
CurrentUser
↓
PermissionsGuard / PoliciesGuard
↓
Controller
