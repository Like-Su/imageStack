# 项目架构说明

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
