# 项目架构说明

## 按性能清单实施的优化

- 新增 `GET /albums/:id/summary`、`GET /tags/:id`，详情页只读取所需摘要；原有列表及相册详情接口继续兼容。
- `POST /tags/assets` 接受 `{ ids, names }`，返回 `{ assets: [{ id, tagIds }], tags, createdCount }`；`DELETE /tags/:id/assets` 接受 `{ ids }`，返回 `{ count, tag }`。每批最多 100 个不同资产、50 个标签名，整批校验与写入在串行化事务中完成，任一无效/越权资产会整批回滚，旧单资产接口保留。
- 标签合并使用数据库集合操作；管理用户列表不再返回未使用的内联头像。JWT 黑名单与会话撤销用一次 Redis `MGET`；媒体票据校验复用已读取的会话版本，不放宽停用或撤销规则。
- 媒体读取只 select 传输所需字段；分享成员条件并入资产查询，重复保存优先读取幂等回执。存储清理按一批键查询全部文件和活动上传引用，查询失败则保留对象，不跳过共享存储保护。
- 媒体补投并发上限为 4，一组全部发布成功才推进游标；同一进程的并发 enqueue 可复用在途任务。AI 空闲时退避至 30 秒并加最多 1 秒抖动，本地入队/完成会唤醒，跨进程变化由兜底扫描处理。
- 新增 `GET /uploads/sessions/:id/progress` 返回 `{ status, expired, merging, file }`，合并等待不读取/检查全部分片；完整会话接口仍做续传校验。终态上传分片清理每轮最多 25 个会话、2 个会话并发。
- 本批性能改造无数据库模型变更，按要求未运行测试或迁移。先部署服务端，再发布依赖新接口的前端；已实施、部分实施和待处理项见 [性能优化清单](../../docs/性能优化.md)。

## 图片与相册短链分享

新增迁移 `20260912130000_short_link_sharing`，部署时执行 `pnpm --dir apps/server run db:migrate`、`pnpm --dir apps/server run db:generate` 后重启服务。不会修改已有图库和旧 `FileShare` 数据。

| 接口                                                    | 权限与行为                                                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `POST /shares`                                          | 需 `asset:share` 且拥有目标；JSON 为 `{ kind: "asset" 或 "album", targetId, expiresInDays: 7 }`，有效期支持 1/7/30 天或 0（永久） |
| `GET /shares?kind=album&targetId=...`                   | 需 `asset:share`，仅返回当前用户为该目标创建的最近 50 条链接                                                                      |
| `DELETE /shares/:id`                                    | 分享者撤销自己的链接；失去分享权限后仍可撤销                                                                                      |
| `GET /shares/:token`                                    | 无需登录，返回当前可分享图片、相册说明和有效期；`cursor` / `limit` 分页，默认 24、最大 100                                        |
| `GET /shares/:token/assets/:assetId/thumbnail` / `file` | 无需登录，但每次检查短链状态、所有者状态和图片成员关系；缩略图处理中返回 202，原图沿用流式读取                                    |
| `POST /shares/:token/save`                              | 登录的启用账户可保存，受 CSRF 保护；返回 `alreadySaved`、`count`、`assetId` / `albumId`                                           |

- 使用 128 位安全随机令牌生成 `/s/<22 字符>` 短链，不包含登录令牌。持有短链即有查看、读取原图和登录转存权限，请勿分享不希望公开的私密图片；原图可能包含 EXIF 位置。公开响应不返回存储路径、账户邮箱、哈希或 EXIF JSON，审计记录不写入短链令牌。
- 仅支持图片，相册链接实时反映未删除图片（不包含视频），一次最多分享/保存 500 张。过期、撤销、源文件/相册删除、分享者停用或分享权限撤销后不可访问。已获取的图片无法追溯收回。
- 转存属于接收者的独立 `FileNode` / `Album`，不复制收藏、标签、权限或原相册关系；原文件和派生文件复用不可变存储对象，现有引用计数负责最终删除，不重复上传或复制文件字节。接收者无需上传权限；转存不授予额外的编辑、删除、下载或分享权限。
- 保存、回执和审计在可串行化事务内完成；按短链和接收者唯一回执防止重复点击产生副本。读取源记录后使用共享行锁，避免并发删除或替换派生文件导致转存悬空。同一链接仅保存一次当时的内容，之后相册新增内容不会自动同步；删除已保存的副本不清除回执，重新导入需新分享链接。
- 相册转存创建带唯一后缀的新相册，避免覆盖同名相册；保存后原作者撤销短链、删除原资源都不影响接收者的副本。未完成处理的图片进入 `PENDING`，由现有后台补投机制继续处理。

## 用户、角色与权限管理

管理员可在侧栏「访问管理」进入 `/admin/users`、`/admin/roles`、`/admin/permissions` 管理账户和授权，点击「编辑与授权」修改用户角色、额外权限或角色权限。沿用现有单角色模型：每个用户关联一个角色，实际权限为角色权限与用户额外权限的并集。`ROLE_ADMIN` 保持全部操作权限；普通账户即使持有 `system:*` 权限，也不能调用管理员管理接口。

用户列表展示生效权限数量，编辑窗口可预览角色继承与额外授权合并后的权限；账户或角色停用时标记为未生效，管理员显示为全部权限。接口与部署说明见 [IAM.md](../../IAM.md)。

部署时先执行迁移，再生成客户端并重启服务：

```sh
pnpm --dir apps/server run db:migrate
pnpm --dir apps/server run db:generate
```

新增迁移 `20260911200000_iam_user_permissions` 创建 `UserPermission` 关联表，并移除角色说明的唯一约束；不修改现有用户、角色或默认授权。全新环境仍使用已有 `db:init` 初始化管理员。

| 方法           | 路径                                            | 功能                                                                             |
| -------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| GET            | `/user?page=1&limit=20&search=&status=&roleId=` | 用户分页列表；可按名称/邮箱、状态和角色筛选，省略空筛选参数                      |
| POST           | `/user`                                         | 创建用户：`username`、`email`、`password`、`roleId`、`status`、`permissionCodes` |
| PATCH          | `/user/:id`                                     | 编辑用户、重设密码、调整角色和额外权限                                           |
| PATCH          | `/user/:id/permissions`                         | 以 `permissionCodes` 全量替换用户额外权限；空数组清空额外权限                    |
| DELETE         | `/user/:id`                                     | 软删除用户并撤销其会话，保留媒体和邮箱                                           |
| GET / POST     | `/role`                                         | 列出 / 创建角色                                                                  |
| PATCH / DELETE | `/role/:id`                                     | 修改 / 删除角色                                                                  |
| GET / PATCH    | `/role/:id/permissions`                         | 查询 / 全量替换角色权限                                                          |
| GET / POST     | `/permission`                                   | 列出 / 创建权限                                                                  |
| PATCH / DELETE | `/permission/:id`                               | 修改 / 删除权限，支持 `parentId: null` 移至根层级                                |

`POST /user/me` 仍供所有已登录用户使用，复用基础认证信息缓存，并单独查询最新 `username` / `avatar`，避免重复关联授权表或返回缓存中的旧昵称。头像仅出现在资料返回类型中，不进入认证缓存或 `req.user`；读取历史缓存时会移除其中的头像字段。旧的 `POST /user/create`、`POST /user/delete` 保留为同等校验的别名；`GET /user/list-users` 使用新的 `page`、`limit` 参数与分页返回结构。列表和写接口均不返回密码哈希。

个人资料修改使用 `PATCH /user/me`，所有已登录且启用的账户均可调用，无需管理员权限。JSON 仅接受 `username`（去除首尾空白，1–80 个字符）及可选 `avatar`；省略头像表示保持原头像，`null` 表示移除。头像只接受 PNG/JPEG/WebP 的 Base64 data URL（整个字符串不超过 65536 字符），拒绝远程地址与 SVG，服务端核对实际格式并转码为最大 256px 的 WebP 后存入现有头像字段。接口从当前令牌取得用户 ID，并校验会话版本、账户和角色状态，不接受用户 ID、邮箱、密码或授权字段。返回更新后的完整登录资料并清除认证资料缓存，不更改会话版本或中断现有登录，无需数据库迁移。资料修改与 `user.profile.update` 审计记录在同一可串行化事务中完成；`beforeJson` / `afterJson` 只包含 `usernameChanged`、`avatarChanged` 布尔标记，不记录昵称或头像内容，日志写入失败会回滚修改。

- 管理员创建的账户默认启用，无需发送激活邮件；密码至少 8 位、最多 72 字节。修改时省略 `password` 表示保持原密码。
- 禁止管理员删除/停用自己或撤销自己的管理员角色，并通过可串行化事务保护最后一个有效管理员。所有管理写入在事务内重新核验操作者身份并记录审计日志，不记录密码内容。
- 内置角色不能删除或改编码，管理员角色不能停用；有关联未删除用户的角色需先转移用户才能删除。已删除用户在移除角色时归入默认普通用户角色，媒体仍保留。
- 内置权限可以改显示名称和层级，但不能删除或改编码。父子层级不可成环；删除有子项的权限前需先调整子项。删除自定义权限会级联移除用户与角色的对应授权。
- 父级权限不自动包含子权限；新增自定义权限编码不会自动创建业务能力，相关业务接口必须显式校验该编码。资源的所有权校验不因授权管理而放宽。
- 用户/角色修改、权限编码变化及权限删除会在同一事务内递增受影响用户的会话版本。旧 access/refresh token 随即失效；权限缓存按会话版本隔离，避免缓存回填恢复旧授权。旧激活链接也不能重新启用管理员已停用的账户。

## 多格式图片与视频

上传、图库/搜索、收藏/相册/标签、回收站与后台处理使用同一组媒体类型：

| 类型                        | 扩展名                                     | 限制                             |
| --------------------------- | ------------------------------------------ | -------------------------------- |
| JPEG                        | `.jpg`、`.jpeg`、`.jfif`、`.pjpeg`、`.pjp` | 10 MiB                           |
| PNG / APNG、WebP、GIF、AVIF | `.png`、`.apng`、`.webp`、`.gif`、`.avif`  | 10 MiB，动图最多 1000 帧         |
| SVG                         | `.svg`                                     | 10 MiB，仅安全静态图形和内联样式 |
| 视频                        | `.mp4`、`.mov`、`.mkv`（不区分大小写）     | 512 MiB、4 小时                  |

图片和视频上传不限制像素或分辨率；图片校验、缩略图和 AI 识别均不设置输入像素上限，`GET /system/capabilities` 的 `upload.maxPixels` 返回 `null` 表示不限制。文件大小、动图帧数、视频时长和解码超时保护仍保留，存储层 `STORAGE_MAX_FILE_BYTES` 可以进一步限制上传大小。文件扩展名只用于预检，服务端还会识别签名、解码图片或通过 ffprobe 校验真实视频流；AVIF 必须使用 AV1。JPEG 扩展名统一保存为 `image/jpeg`，APNG 使用 `image/apng`。

- 原文件字节保持不变，BLAKE3 校验覆盖完整内容。图片缩略图取首帧并纠正 EXIF 方向，不将 GIF/APNG 原文件转为静态图；地点聚合仍只使用图片已有 GPS。
- `PATCH /api/assets/:id` 修改图片或视频名称，请求体为 `{ "name": "新的名称.jpg" }`，返回 `id`、`name` 和 `updatedAt`。需要 `asset:edit` 权限，仅可修改未删除的自有媒体；名称去除首尾空白后最多 255 个字符，禁止路径分隔符和控制字符，并须保留原扩展名（不区分大小写）。只更新已有 `FileNode.name`，不修改原文件、存储路径、相册或分享链接，无需数据库迁移。
- SVG 使用 `sax` 严格 XML 解析与静态元素限制，拒绝 DTD、脚本、事件、外链、`foreignObject`、SMIL、嵌入图片和样式表。允许本地片段引用及受限内联样式；限制节点数与嵌套深度。原 SVG 响应增加沙箱 CSP，前端仅作为图片显示，不注入 DOM。
- 视频通过私有临时文件流式接收与计算哈希，不将大视频整体放入 Node 内存。后台同样流式读取，生成最长边 1024px、质量 90 的 WebP 封面和不超过 1920×1080 的 H.264/AAC MP4 兼容预览；若预览超出 512 MiB、超时或解码失败，任务会重试/失败，原文件仍可下载。
- `GET /api/assets/:id/file` 始终返回原文件；新增 `GET /api/assets/:id/preview` 返回视频兼容预览。二者均要求登录、`asset:download` 权限和未删除的自有资源，支持单段 Range。预览未就绪返回 `202` 与 `Retry-After: 3`，失败返回 `422`，不会返回原视频冒充兼容文件。
- 资产摘要/详情增加 `durationMs`，详情增加 `previewUrl`，上传结果包含 `mediaType` 与 `durationMs`；时长按毫秒字符串返回。复用已有 `FileNode.previewKey` 和 `durationMs`，不需要新数据库迁移。

### 部署前提

依赖清单与两份锁文件已将已有间接依赖 `sax` 提升为直接依赖，部署时同步依赖即可。视频功能还需单独安装 FFmpeg/ffprobe（建议 6 或更新版本，包含 `libx264`、AAC、`libwebp` 及对应输入解码器）：

| 变量                                | 默认值    | 用途                                   |
| ----------------------------------- | --------- | -------------------------------------- |
| `FFMPEG_PATH`                       | `ffmpeg`  | 可执行文件路径，不含命令行参数         |
| `FFPROBE_PATH`                      | `ffprobe` | 可执行文件路径，不含命令行参数         |
| `MEDIA_VIDEO_PROBE_TIMEOUT_MS`      | `30000`   | 视频信息读取时限                       |
| `MEDIA_VIDEO_PROCESSING_TIMEOUT_MS` | `600000`  | 单次封面/转码命令时限，可配置到 1 小时 |

只在接收视频或处理任务时调用工具，不在应用启动时执行探测。工具调用不经过 shell，限定 MP4/MOV/Matroska 解复用器、仅允许本地文件协议、禁用 MOV 外部数据引用，使用固定参数和随机私有临时目录。临时目录需要足够空间容纳原视频和派生文件；正常完成及失败时会清理，异常断电遗留目录需由部署环境定期清理。视频接收超时为 10 分钟，反向代理也需允许至少 512 MiB 请求体及相应上传/读取时限。

浏览器不一定原生支持 MOV/MKV 或某些编码，前端明确区分原视频和兼容预览，下载始终保持原文件。未部署工具时上传视频返回明确的服务不可用错误，不伪造处理成功。

## M7：基础关键词搜索

新增 `GET /search`，使用 Prisma 查询文件名和手动标签，默认且仅支持 `mode=keyword`。
请求需要登录和 `asset:search` 权限，仅返回当前用户未进入回收站的资产。
不接入 AI、OCR、向量搜索、关键词联想或搜索历史，不新增依赖及数据库迁移。

### 参数与语义

| 参数               | 默认值      | 说明                                                                 |
| ------------------ | ----------- | -------------------------------------------------------------------- |
| `q`                | 空          | 最长 200 字符，按空白拆分，最多 16 个不同关键词                      |
| `mode`             | `keyword`   | 仅关键词模式；`auto`、`semantic` 返回 400                            |
| `type`             | 不限        | `image`、`video`、`audio`，兼容大写                                  |
| `favorite`         | 不限        | `true` 仅收藏，`false` 仅未收藏                                      |
| `tag` / `tagId`    | 不限        | 精确标签名 / 标签 ID；同时传入时必须匹配同一标签                     |
| `albumId`          | 不限        | 手动相册 ID                                                          |
| `status`           | 不限        | `PENDING`、`PROCESSING`、`READY`、`FAILED`；历史空状态归入 `PENDING` |
| `timeField`        | `createdAt` | `createdAt` 为入库时间，`takenAt` 为 EXIF 拍摄时间                   |
| `year`             | 不限        | UTC 年份，1～9999；与 `from` / `to` 取交集                           |
| `from` / `to`      | 不限        | 包含下界 / 不包含上界，支持日期或带时区的 ISO 8601 时间              |
| `cursor` / `limit` | 无 / `24`   | 游标分页，单页最多 100 条                                            |

关键词不区分大小写，每个词必须在文件名或某个标签名中出现；词之间为 AND，字段之间为 OR。
例如 `海边 日落` 可由文件名命中“海边”、标签命中“日落”。`%`、`_`、反斜杠按字面匹配，
不开放 SQL 通配符、表达式或自然语言时间解析。空关键词只做筛选，无条件时按图库顺序浏览。
所有结构化条件与关键词取交集，不会因为匹配标签而绕过用户隔离、回收站或其他筛选。

日期 `2026-09-01` 表示 UTC 零点；时间戳必须带 `Z` 或时区偏移，最多毫秒精度。
时间区间为 `[from, to)`，同时提供时必须 `from < to`；例如九月使用 `from=2026-09-01&to=2026-10-01`。
拍摄时间筛选不回退到入库时间，没有 EXIF 拍摄日期的资产不命中此类时间范围。
`/assets` 和 `/assets/trash` 同步支持 `type`、`timeField`、`year`、`from`、`to`，原有筛选仍然兼容。
当前支持上述图片和 MP4/MOV/MKV 视频，`video` 可正常检索；音频上传仍未接入，`audio` 暂时返回空列表。

### 请求与分页

以下示例使用默认 `/api` 前缀，实际以 `API_PREFIX` 为准；客户端需正常编码 URL 参数：

```http
GET /api/search?q=海边%20日落&mode=keyword&favorite=true&type=image&tag=旅行
GET /api/search?timeField=takenAt&from=2026-09-01&to=2026-10-01&status=READY
GET /api/assets?type=image&year=2026&timeField=createdAt
```

结果继续使用 `{ success: true, data, timestamp }` 包装；`data` 包含 `mode: "keyword"`、
`items`、`hasMore`、`nextCursor`、`tookMs` 和 `parsed: null`。
每条命中为 `{ asset, score: null, matchedBy: ["keyword"] }`，`asset` 与图库摘要一致；
没有关键词时 `matchedBy` 为 `["filter"]`，不会提供伪造的相似度分数。

排序固定为 `createdAt DESC, id DESC`，搜索与图库共用稳定的游标分页和资产摘要。
搜索游标绑定当前用户、关键词及全部筛选条件；翻页时保持条件不变，只替换 `cursor`，可调整 `limit`。
切换条件必须清空游标；跨用户、跨条件、损坏的游标或混用图库游标均返回 400。
原有图库与回收站的无搜索上下文游标保持兼容。

本次仅实现并做静态核对，不安装依赖、不执行构建、测试或服务启动。

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
- Worker 对受支持的图片生成最长边 1024px、质量 90 的 WebP，自动纠正方向且不放大小图；GIF/APNG 等动图取首帧，视频封面采用同样的尺寸和质量，并使用 Lanczos 缩放。
  `size=sm` 保留为兼容接口参数，图库、大卡片和详情预览统一读取高清缩略图，不直接下载原文件。
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

### 缩略图清晰度升级

部署本次升级前，在 `apps/server` 执行数据库迁移并重新生成 Prisma Client，然后重启服务和 Worker：

```bash
pnpm run db:migrate
pnpm run db:generate
```

迁移 `20260912120000_thumbnail_quality` 仅为 `FileNode` 增加 `thumbnailVersion`，默认值 0 标记历史缩略图。
图片与视频封面的生成参数统一维护在 `THUMBNAIL_PROFILE`，成功写入新缩略图时才更新版本号。
访问旧版本缩略图时，已完成资产会通过条件更新重新进入现有处理队列；返回 `202` 供客户端重试，不在请求线程内转码，也不要求重新上传。
重复访问不会重置正在执行任务的重试次数；视频已有的兼容预览和 HLS 不会仅因封面升级而重建。
替换成功后沿用引用检查清理旧对象，新存储标识使 ETag 更新；原文件、收藏、相册、标签和回收站状态保持不变。
升级失败时保留并返回仍可用的旧缩略图，沿用现有失败任务的手动重试机制，不无限自动重试。

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
| POST / DELETE  | `/albums/:id/assets`                  | `{ ids }` 添加 / 移出相册成员，返回 `{ count, album }`                  |
| GET / POST     | `/tags`                               | 手动标签云 / 新建 `{ name }`                                            |
| PATCH / DELETE | `/tags/:id`                           | 改名 `{ name }` 或手动合并 `{ mergeIntoId }` / 删除标签                 |
| POST           | `/assets/:id/tags`                    | `{ names }` 自动创建并关联手动标签，返回 `{ tags, createdCount }`       |
| DELETE         | `/assets/:id/tags/:tagId`             | 解除该资产与标签的关联，返回 `{ count, tag }`                           |

资产分页默认 `limit=24`，范围为 1～100，按 `createdAt DESC, id DESC` 排序。
切换视图或筛选条件时清空 `cursor`；`favorite` 只接受 `true` / `false`。
列表增加 `deleted`、`deletedAt` 和 `tags: { id, name, source: "MANUAL" }[]`；
详情另外返回 `albums: { id, name }[]`。

### 一致性与权限

- 所有资源按当前用户隔离，包括管理员；他人资源与不存在的资源均返回 404。
- 批量 `{ ids }` 接受 1～100 个不重复 ID；整个批次先校验，再在可重试的串行化事务中写入。
  只要存在无效或他人 ID，整批回滚。回收/恢复返回 `{ count }`，表示实际变化数；添加/移出相册额外返回更新后的 `album` 摘要，供前端直接更新计数及封面。
- 添加资产标签返回当前全部标签摘要 `tags`（包含计数及封面）和新建标签数 `createdCount`；移除关联返回实际变化数 `count` 及该标签更新后的摘要 `tag`。前端不必再请求整份集合列表；新前端依赖这些字段，部署时先更新服务端。详见 [性能优化清单](../../docs/性能优化.md)。
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
SearchModule M7 文件名/手动标签关键词与结构化筛选；OCR、向量及语义搜索留待后续
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

## 找回密码与 CSRF

以下接口沿用现有 `IamModule/AuthModule`，没有新增依赖或数据库迁移。示例基址为 `/api`，成功响应统一为 `{ success: true, data, timestamp }`，错误响应为 `{ success: false, code, message, details, timestamp, path }`。

### 环境配置

完整示例位于 `.env.example`，实际凭据仍应填写在本地 `.env`，不要提交到仓库。

| 环境变量                  | 说明                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `JWT_SECRET`              | 必填，至少 32 位，使用独立生成的随机密钥；示例故意留空                                    |
| `CSRF_SECRET`             | 可选，至少 32 位；未设置时从 `JWT_SECRET` 按独立用途派生，不使用固定密钥                  |
| `CSRF_COOKIE_SECURE`      | 可选，`true` 或 `false`；默认生产环境为 `true`、开发环境为 `false`                        |
| `CORS_ORIGIN`             | 同源反代推荐使用 `/api`；跨源同站访问时，填写准确的前端 Origin，多个地址以逗号分隔        |
| `APP_DOMAIN`              | 前端页面的 HTTP(S) 基址，不是 API 基址；用于邮件中的激活和重置链接，不应带查询参数或片段  |
| `MAIL_HOST` / `MAIL_PORT` | SMTP 地址和端口；示例的 `localhost:1025` 仅适用于自行配置的开发邮件服务                   |
| `MAIL_SECURE`             | `true` 表示 SMTP 直连 TLS；通常 465 使用 `true`，587 使用 `false` 并由 SMTP 协商 STARTTLS |
| `MAIL_USER` / `MAIL_PASS` | SMTP 认证信息；支持匿名中继时可留空，否则填写邮箱服务商的用户名和授权码                   |
| `MAIL_SEND_FROM`          | 发件人，必须与 SMTP 服务允许的发送地址匹配                                                |

生产环境建议使用 HTTPS，保留 Secure Cookie。若显式配置 `CSRF_COOKIE_SECURE=false`，会降低传输安全性。`CORS_ORIGIN=*` 不启用跨源凭据；不要将通配 Origin 与凭据访问混用。Cookie 使用 `SameSite=Lax`，推荐同源反代或同站部署，不支持将互不相关的站点直接作为带 Cookie 的前后端。

### 1. 获取 CSRF 令牌

`GET /api/auth/csrf`，无需登录，每个 IP 每分钟最多 30 次。浏览器请求需要保留 Cookie，例如使用 `credentials: 'include'`。

```json
{
  "success": true,
  "data": { "csrfToken": "<签名安全令牌>" },
  "timestamp": "<ISO 8601>"
}
```

响应同时设置两个 HttpOnly Cookie：随机浏览器标识和签名 CSRF 令牌。HTTPS/Secure 模式使用 `__Host-` Cookie 名称、`Path=/`，不设置 Domain，Cookie 有效期为 24 小时。接口禁止缓存；合法 Cookie 对会复用令牌，避免多个页面互相使其失效。过期、损坏或签名失效的 Cookie 会在重新获取时换发。

之后所有 POST、PUT、PATCH、DELETE 等非安全请求，包括登录、注册、刷新、发邮件、密码重置和退出，均需要：

```http
Cookie: <浏览器自动携带，或 API 客户端保存的 Cookie Jar>
x-csrf-token: <data.csrfToken>
Content-Type: application/json
```

GET、HEAD、OPTIONS 不做 CSRF 校验。令牌只从请求头读取，不接受查询参数或请求体作为替代。客户端不需要、也不能通过 JavaScript 读取 HttpOnly Cookie；只使用签发响应中的 `csrfToken`。认证接口仍需原有的 `Authorization: Bearer <accessToken>`，CSRF 令牌不替代用户认证。

校验失败返回 `403 / CSRF_TOKEN_INVALID`，不会执行业务处理。客户端可以重新获取令牌并至多重试一次，且应合并并发的获取请求；不要对其他 403 错误无条件重试。如果仍失败，检查 Cookie、HTTPS、代理和 CORS 配置，而不是关闭校验。

### 2. 发送找回密码邮件

先调用现有 `GET /api/auth/captcha` 获取图形验证码，随后调用：

- `POST /api/auth/forget/send-code`
- 兼容入口：`POST /api/auth/reset/send-code`

```json
{
  "email": "you@example.com",
  "captcha": "<4 位图形验证码>",
  "captchaId": "<captcha 接口返回的 UUID>"
}
```

成功受理返回 HTTP 202：

```json
{
  "success": true,
  "data": {
    "message": "请求已受理。若账户可用，请留意密码重置邮件；未收到请稍后重试或联系管理员。",
    "expiresIn": 1800,
    "retryAfter": 60
  },
  "timestamp": "<ISO 8601>"
}
```

- 图形验证码验证时原子消费，无论内容正确与否都不能复用；重试发码前需重新获取图片。
- 两个发码入口共用每 IP 每分钟 3 次的限流；同一邮箱在 Redis 中设置 60 秒发送冷却，并发请求不能重复发送。
- 不存在、未激活或已删除的账户返回相同的受理响应，不发送邮件，不直接暴露账户是否存在。
- 202 仅表示请求受理，不保证邮件最终投递成功。SMTP 或重置码准备失败会记录服务端日志，并尝试仅删除本次码的摘要，不误删后发的码；客户端仍收到统一受理响应。
- 邮件包含一次性重置链接和 **64 位十六进制验证码**，不是 6 位短信码。重置码有 256 位随机熵，仅保存绑定用户及会话版本的 SHA-256 摘要；原始码不会在接口响应中返回。
- 验证码自签发起 30 分钟有效，只有最新一份有效。邮件链接指向 `${APP_DOMAIN}/forgot-password?email=...&emailCode=...`。

### 3. 提交新密码

`POST /api/auth/forget` 或 `POST /api/auth/reset`：

```json
{
  "email": "you@example.com",
  "emailCode": "<邮件或链接中的完整 64 位验证码>",
  "password": "<新的密码>"
}
```

新密码至少 8 位，UTF-8 编码不超过 bcrypt 的 72 字节上限；确认密码由前端验证，不发送 `enterPassword` 等 DTO 外字段。两个入口执行相同逻辑，每个入口每 IP 每分钟最多 5 次。

服务端先原子消费验证码，再以签发时对应的用户会话版本为条件，原子更新密码哈希并递增 `sessionVersion`，最后等待缓存清理完成。成功后返回 HTTP 200、`data: true`，不会自动登录。

旧 access token、refresh token 和旧会话版本对应的重置码失效；并发的登录或刷新不能将已失效会话提升到新版本。相同验证码的重复或并发提交只有一次能通过。若数据库写入失败，不会返回成功，也不会恢复已消费的验证码，需要重新获取邮件。

### 错误约定与前端对接

| HTTP / code                                                                                                                                                                                                                                                                                                                                                        | 处理方式                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `403 / CSRF_TOKEN_INVALID`                                                                                                                                                                                                                                                                                                                                         | 重新获取 CSRF 令牌，保留 Cookie，至多重试一次                               |
| `429 / PASSWORD_RESET_COOLDOWN`                                                                                                                                                                                                                                                                                                                                    | 使用 `details.retryAfter` 或 `Retry-After` 响应头倒计时，随后刷新图形验证码 |
| `429 / HTTP_429`                                                                                                                                                                                                                                                                                                                                                   | 命中接口 IP 限流，根据 `Retry-After` 等待                                   |
| `400 / PASSWORD_RESET_INVALID`                                                                                                                                                                                                                                                                                                                                     | 验证码过期、错误、已消费、账户不可用或会话版本变化，重新获取重置邮件        |
| `400 / HTTP_400`                                                                                                                                                                                                                                                                                                                                                   | 表单校验或图形验证码失败，修正字段或重新获取图片                            |
| `401`                                                                                                                                                                                                                                                                                                                                                              | 登录状态失效，按原有认证流程刷新或重新登录                                  |
| `apps/web` 已接入上述认证流程：请求层统一获取 CSRF 令牌并携带 Cookie 与请求头；发邮件请求仅发送 `email/captcha/captchaId`，重置请求仅发送 `email/emailCode/password`。找回密码页面支持邮件发送冷却、链接填充、一次性验证码提交与重置后重新登录。邮件凭据读取后从地址栏清除，页面使用 `no-referrer` 防止向外部资源泄漏。前端配置与完整流程见 `apps/web/README.md`。 |

| HTTP / code                     | 处理方式                                                                    |
| ------------------------------- | --------------------------------------------------------------------------- |
| `403 / CSRF_TOKEN_INVALID`      | 重新获取 CSRF 令牌，保留 Cookie，至多重试一次                               |
| `429 / PASSWORD_RESET_COOLDOWN` | 使用 `details.retryAfter` 或 `Retry-After` 响应头倒计时，随后刷新图形验证码 |
| `429 / HTTP_429`                | 命中接口 IP 限流，根据 `Retry-After` 等待                                   |
| `400 / PASSWORD_RESET_INVALID`  | 验证码过期、错误、已消费、账户不可用或会话版本变化，重新获取重置邮件        |
| `400 / HTTP_400`                | 表单校验或图形验证码失败，修正字段或重新获取图片                            |
| `401`                           | 登录状态失效，按原有认证流程刷新或重新登录                                  |

`apps/web` 已接入上述认证流程：请求层统一获取 CSRF 令牌并携带 Cookie 与请求头；发邮件请求仅发送 `email/captcha/captchaId`，重置请求仅发送 `email/emailCode/password`。找回密码页面支持邮件发送冷却、链接填充、一次性验证码提交与重置后重新登录。邮件凭据读取后从地址栏清除，页面使用 `no-referrer` 防止向外部资源泄漏。前端配置与完整流程见 `apps/web/README.md`。

> > > > > > > origin/main

本次仅进行代码与接口约定的静态核对，未启动服务、发送实际邮件、运行测试、构建或类型检查。

## 数据库初始化

沿用 `scripts/init.sql` 作为基础数据的唯一来源，`scripts/init.cjs` 负责配置校验、密码哈希和 PostgreSQL 客户端调用，`scripts/init.sh` 提供兼容 Shell 入口。初始化通过部署命令显式执行，不在服务启动或公开接口中自动创建管理员。

### 初始化内容

- 内置角色 `ROLE_ADMIN`、`ROLE_USER`。
- 与 `src/common/constants/role-permission.ts` 一致的 22 个权限，包含资源下载、分享和上传权限。
- 管理员绑定全部内置权限；普通用户仅默认绑定 `asset:list`、`asset:search`。上传、编辑、删除、标签等能力需由管理员按需授权，不向普通用户开放系统管理权限。
- 首个可直接登录的管理员，状态为 `ACTIVE`，无需发送激活邮件。

不创建示例媒体、相册、标签、上传任务或普通用户，不清空现有数据。权限名称、父子关系和缺失的默认授权会同步；自定义角色、权限及额外授权保留，已禁用的角色不会被自动重新启用。

### 配置与执行

先安装工作区依赖及 PostgreSQL 客户端 `psql`，并准备 PostgreSQL 数据库。环境变量优先于 `apps/server/.env`；脚本不会把 `.env` 当 Shell 执行，也不会把密码写入 SQL 文件或命令行参数。

在 `apps/server/.env` 中配置正确的 `DATABASE_URL` 和管理员邮箱（可参考 `.env.example`）：

```dotenv
DATABASE_URL=postgresql://username:password@localhost:5432/imageStack?schema=public
ADMIN_USERNAME=admin
ADMIN_EMAIL=your-admin@example.com
```

在仓库根目录执行以下命令，应用已有 Prisma 迁移后初始化数据：

```bash
pnpm db:init
```

已有完整表结构时，仅补齐基础数据：

```bash
pnpm db:seed
```

未设置密码时会在交互终端隐藏输入并要求确认。密码至少 8 位、UTF-8 不超过 bcrypt 的 72 字节上限，建议使用独立的高强度密码。初始化成功后可使用输出的管理员邮箱进入 `/login`；新建邮箱会规范为小写，已有账户保持原邮箱内容。

自动部署时，通过部署平台的 Secret 注入 `ADMIN_PASSWORD`，或提供预先生成的 `ADMIN_PASSWORD_HASH`，两者只能设置一个；后者支持 bcrypt `$2a$` / `$2b$` / `$2y$`、cost 10～14。仓库中不提供通用管理员密码，也不会在日志中显示明文密码或哈希。非交互环境缺少凭据会直接失败，不会等待输入或使用默认密码。

也可使用原有脚本入口或 Prisma seed 入口（这些入口仅初始化数据，不执行迁移）：

```bash
bash scripts/init.sh
pnpm --dir apps/server exec prisma db seed --config prisma7.config.ts
```

`pnpm --dir apps/server run db:generate` 用于在需要时重新生成 Prisma Client。初始化本身不依赖生成客户端，也不连接 SMTP、RabbitMQ 或 Redis；登录和业务服务仍需按各自配置启动这些依赖。

### 重复执行与安全约束

- 整个 SQL 初始化在一个事务中执行，并通过事务级 advisory lock 避免多个初始化实例并发写入。SQL 错误会回滚，命令返回非零退出码，不会自动重试不确定的执行结果。
- 必须先应用迁移；表缺失、仍有旧 `User.account` 字段、缺少 `sessionVersion` 时会明确报错。当前脚本仅支持 `public` schema；Prisma 连接串中的 `schema=public` 与连接池参数会转换为适合 `psql` 的连接配置。
- 已有正常管理员默认保留密码、昵称和会话，不会被新传入的密码覆盖。已有普通用户、停用或软删除账户与目标邮箱冲突时默认拒绝；邮箱忽略大小写后对应多个账户时始终拒绝，需先人工处理歧义。
- 只有明确执行 `pnpm db:seed --force-admin`（或 `bash scripts/init.sh --force-admin`）才会重置目标账户的密码、昵称、角色与状态，并递增 `sessionVersion` 撤销旧访问/刷新令牌。已禁用的 `ROLE_ADMIN` 仍需单独恢复，不会因该选项被偷偷启用。
- 重新补齐已有数据库的授权或强制重置后，现有 Redis 用户权限快照可能仍缓存旧资料，最长 30 分钟。部署时应按实例配置清理用户权限缓存或等待其过期；初始化脚本不执行 `FLUSHDB`，不删除刷新令牌、验证码或其他业务数据。强制重置的旧会话撤销依赖数据库版本检查，不受该缓存影响。

本次只实现脚本并做静态核对，不执行数据库迁移、初始化写入、管理员重置或服务启动。

## 媒体工作区补充接口

前端工作区按照 `design/index.html` 接入已有资产、上传、相册、标签和关键词搜索接口，并增加以下能力；复用现有 FileNode/Album/Tag 数据模型，无新增迁移。

| 方法   | 路径（以 `/api` 为基址） | 权限           | 返回/行为                                                                                                  |
| ------ | ------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------- |
| GET    | `/assets/overview`       | `asset:list`   | 当前用户未删除/回收站数量、收藏、相册、标签、原图字节字符串与 `PENDING/PROCESSING/READY/FAILED` 统计       |
| GET    | `/assets/places`         | `asset:list`   | 当前用户未删除图片的 EXIF 经纬度按 0.1° 网格聚合；`items/locatedAssets/totalPlaces`，数量最多的 500 个分组 |
| GET    | `/assets/trash/:id`      | `asset:list`   | 自己的回收站媒体详情，`fileUrl` 为 null，缩略图仍走已有回收站路由                                          |
| POST   | `/assets/:id/retry`      | `asset:edit`   | 仅重置自己的未删除 FAILED 入库记录；`{id,status:'PENDING',enqueued}`，队列暂不可用时由数据库补投           |
| DELETE | `/assets/trash`          | `asset:delete` | `{ids}`，1～100 个不重复 ID；仅允许自己的回收站图片，返回 `{count,cleanupPending}`                         |
| GET    | `/system/capabilities`   | `asset:list`   | 已实现的后端能力与未接入扩展、上传限制、存储类型等；不是健康探测，也不提供插件安装/启停                    |

列表和搜索新增可选条件 `uncategorized`（布尔）、`minSize`（非负安全整数，字节）、`placeId`（`纬度网格整数:经度网格整数`，分别是原始坐标乘 10 向下取整）。条件与所有者、回收站状态及原有筛选取交集；`placeId` 的有效范围为纬度格 -900～900、经度格 -1800～1800。关键词搜索游标签名范围包含这些新条件。

资产摘要补充 `processingAttempts`、`nextAttemptAt`、`updatedAt`，标签摘要补充 `coverAssetId`（该用户的未删除图片），用于任务中心和手动人物分组预览。人物以约定前缀 `人物:` 的普通标签存储，复用标签增删改/合并和媒体关联的权限与所有者隔离，不包含自动检测、识别或人脸裁剪模型。

### 永久删除约束

- 先在可串行化事务内校验全部 ID 都是该用户的回收站图片，删除分享和文件授权，移除文件记录；相册/标签关联与封面/上传会话关系沿用已有外键规则处理。未删除或其他用户文件不会被永久删除。
- 提交后对原图、缩略图和预览对象去重，检查所有文件引用及未完成上传会话，再清理无引用对象。数据库删除成功、存储清理失败时保留错误日志并返回 `cleanupPending`；不会回滚为可访问的损坏记录，也不假称空间释放成功。需由管理员依据日志处理残留对象。
- 前端清空先收集当前 ID 清单再确认，以每批 100 项提交；各批独立事务，不承诺整库删除原子性，失败/中断后需刷新查看剩余记录。不自动重试超时的永久删除请求，也不实施自动保留 30 天策略。
- 上述写接口沿用全局 JWT/权限/CSRF 保护，能力和统计只读接口不泄露其他用户资产信息或磁盘路径。

相关实现仅作源码静态核对，未启动服务、运行测试/构建/类型检查、发起真实上传或删除、执行数据库写入。

> > > > > > > Stashed changes
> > > > > > > \=======
> > > > > > > 当前工作区的 `apps/web` 为模板文件，未保留此前的认证页面，本次未覆盖前端。接回页面时，发邮件请求只发送 `email/captcha/captchaId`，重置请求只发送 `email/emailCode/password`，并统一接入上述 CSRF 请求头和 Cookie。重置页面读取链接后应从地址栏清除验证码，并设置 `Referrer-Policy: no-referrer`，避免向外部图片或链接泄露验证码。

本次仅进行代码与接口约定的静态核对，未启动服务、发送实际邮件、运行测试、构建或类型检查。

> > > > > > > 9aae55d2dce0843fa4eddf1be531eb55fd28729d
