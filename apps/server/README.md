# 项目架构说明

## M5：缩略图与 EXIF 异步处理（RabbitMQ）

上传完成后通过 RabbitMQ 投递 `asset.ingest`，由 `JobsModule` 中的消费者
在后台生成缩略图、提取 EXIF 并更新 `FileNode`。M5 队列不使用 Redis 或 BullMQ；
原有登录、验证码等认证缓存的 Redis 逻辑不在本次替换范围内。
任务中心、手动重试/取消、进度 SSE 和前端页面留到后续阶段。

### 依赖与配置

使用已有的 `amqp-connection-manager`、`amqplib`、sharp 和新增的 `exifr`，移除直接依赖 `bullmq`。
接入前在仓库根目录同步依赖和锁文件，然后应用迁移并生成 Prisma Client：

```bash
pnpm install --no-frozen-lockfile
cd apps/server
pnpm exec prisma migrate deploy --config prisma7.config.ts
pnpm exec prisma generate --config prisma7.config.ts
```

迁移 `20260908120000_m5_rabbitmq_processing` 为 `FileNode` 增加重试次数、处理令牌、
租约到期时间和下次执行时间及相应索引。现有文件默认重试次数为 0；旧的未完成记录会自动补投。
切换时先停止旧的 BullMQ 工作进程，避免两种实现同时写入；不需要搬运 Redis 中的媒体消息。
依赖安装、锁文件解析、数据库迁移、客户端生成、服务启动和验证不在本次代码交付中执行。
sharp 需要与实际运行平台匹配的原生依赖，不应直接复用其他操作系统安装的 `node_modules`。
上传校验与后台处理统一通过 `src/common/sharp.ts` 加载 sharp，兼容当前 CommonJS 编译配置与 sharp 0.35 的导出类型。

| 配置                                     | 默认值                              | 说明                                                               |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `RABBITMQ_URL`                           | `amqp://guest:guest@127.0.0.1:5672` | 支持 `amqp://`、`amqps://` 和 URL 中的 vhost；远程部署使用独立账户 |
| `RABBITMQ_QUEUE_PREFIX`                  | `image-stack`                       | 环境隔离前缀，不允许以 RabbitMQ 保留的 `amq.` 开头                 |
| `RABBITMQ_CONNECT_TIMEOUT_MS`            | `10000`                             | RabbitMQ 连接超时                                                  |
| `RABBITMQ_PUBLISH_TIMEOUT_MS`            | `5000`                              | 等待发布确认的最大时长，超时由数据库记录兜底                       |
| `MEDIA_PROCESSING_CONCURRENCY`           | `2`                                 | 每个服务进程的处理并发，范围 1～8                                  |
| `MEDIA_PROCESSING_ATTEMPTS`              | `3`                                 | 最大执行次数，含首次执行                                           |
| `MEDIA_PROCESSING_LEASE_MS`              | `120000`                            | 数据库处理租约，每隔租约时长的 1/3 自动续期                        |
| `MEDIA_PROCESSING_BACKOFF_MS`            | `1000`                              | 重试指数退避的初始延迟                                             |
| `MEDIA_PROCESSING_RECONCILE_INTERVAL_MS` | `30000`                             | 数据库待处理记录的补投间隔                                         |
| `MEDIA_PROCESSING_RECONCILE_BATCH_SIZE`  | `100`                               | 每次按 ID 游标扫描的记录数                                         |
| `MEDIA_PROCESSING_READ_TIMEOUT_MS`       | `30000`                             | 单次原图流读取超时                                                 |
| `MEDIA_EXIF_DEFAULT_OFFSET`              | `+00:00`                            | EXIF 没有时区时的回退偏移；国内相机可按需要设为 `+08:00`           |

RabbitMQ 使用持久化队列、持久化消息、发布确认和手动 ACK，账户需要目标 vhost 的配置、读、写权限。
默认主队列为 `image-stack.media-processing`，失败队列为 `image-stack.media-processing.failed`。
重试队列按延迟命名，如 `.retry.1000`、`.retry.2000`，通过队列 TTL 和死信路由返回主队列，
不需要延迟消息插件。不同延迟使用独立队列，避免较长延迟阻塞较短延迟消息。
重试消息或失败记录发布确认后才 ACK 原消息；无法路由的消息触发重连和队列重建。
失败队列保留原任务及 `x-media-attempt`、`x-media-error` 头，非法消息直接进入死信队列。

连接使用 15 秒心跳、5 秒重连间隔；断线、流控或发布确认超时不会回滚已上传文件。
服务启动不等待 RabbitMQ 可用，连接恢复后自动恢复拓扑、消费者及数据库补投。
消费者通过 prefetch 限制并发，重连时先等待旧通道的处理收尾，再接收新消息；
关闭服务时先停止消费和补投，等待正在执行的任务收尾，再关闭连接；
Prisma 在 `onApplicationShutdown` 阶段断开，确保媒体任务排空时仍可写入数据库。

### 状态流转与接口

```text
上传校验 → 存储原图 → FileNode(PENDING) → RabbitMQ
                                          ↓
                                      PROCESSING
                                      ↙        ↘
                                    READY     处理失败
                                              ↙    ↘
                              PENDING（退避重试）   FAILED
```

- 上传入口仍为 `POST /uploads/sessions` 与 `PUT /uploads/sessions/:id/content`。
  上传会话 `COMPLETED` 表示原图和文件记录已保存，不表示后台媒体处理已经结束。
  入队发生在数据库提交之后，RabbitMQ 短暂故障不会回滚或删除已上传文件。
- 原有 `GET /assets/:id` 返回 `status`、`processingError`、EXIF、方向修正后的宽高及拍摄时间。
  `GET /assets` 和 `GET /assets/trash` 新增 `status=PENDING|PROCESSING|READY|FAILED` 筛选。
- 普通资产和回收站的缩略图接口只读取现有 WebP；未就绪时返回 `202`、`Retry-After: 3`
  和 `{ success: true, data: { assetId, status }, timestamp }`，客户端应显示占位图并稍后重试。
  失败且没有可用缩略图时返回 `422 / ASSET_PROCESSING_FAILED`。
  已完成资产的缩略图文件丢失时会重置重试次数并重新排队修复；已有缩略图不受 EXIF 重试影响。
- Worker 对当前支持的 JPEG、PNG、WebP 生成最长边 256px 的 sm WebP，自动纠正方向且不放大小图。
  保留上传阶段的大小、像素和单帧限制，处理过程有流读取和解码超时。
- EXIF 从 sharp 的原始 EXIF 块提取，由 exifr 解析后仅保存常用相机、镜头、曝光、方向、
  GPS 与时间字段，过滤二进制和不可 JSON 化的值。没有 EXIF 的图片正常完成，`exif` 为 `{}`。
  拍摄时间优先使用 `DateTimeOriginal`，其次 `CreateDate`，结合 EXIF 偏移或配置偏移转成 UTC；
  无效日期保留为 `null`，不使用服务器本地时区猜测。
- RabbitMQ 采用至少一次投递，消息 ID 不提供去重保证。消费者通过数据库条件更新领取资产、
  增加重试次数并生成租约令牌；重复消息不会领取仍在有效租约内的资产，旧消费者也不能覆盖新任务结果。
  重试次数和下次执行时间持久化，重复投递不会重置次数或绕过退避时间，崩溃中断的执行也计入次数。
- 启动及周期扫描补投到期的 `PENDING`、历史空状态和租约过期的 `PROCESSING` 记录。
  消息丢失、发布结果不确定或进程崩溃均可从数据库恢复；达到次数上限后进入 `FAILED`，不会无限重试。
  已失败资产不会自动重新执行。补投使用游标轮转，不会一直只扫描最早的一批资产。
- 软删除不取消媒体处理，回收站资产仍可完成并预览；处理不会更改删除、收藏或相册/标签关系。
  更新限定资产、所属用户、原存储对象及处理令牌，成功时一次性写入缩略图引用、元数据与 `READY`。
  竞争失败时清理未关联的候选缩略图；数据库写入结果不确定时保留对象，避免误删已关联文件。

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
| GET            | `/assets/trash/:id/thumbnail?size=sm` | 回收站缩略图；M5 起由后台生成，未就绪返回 202                           |
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
JobsModule RabbitMQ 媒体处理与恢复；后续扩展任务查询、暂停、重试、取消、SSE 推送
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
