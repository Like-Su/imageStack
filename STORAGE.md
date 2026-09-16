# 存储策略与 RustFS

支持通过 `LOCAL_FS` 选择本地文件系统，通过 `RUST_FS` 选择自部署的 RustFS S3 兼容对象存储。存储配置统一使用 `STORAGE_*` 命名，由选定的适配器读取。默认仍为 `LOCAL_FS`，不需要修改前端上传或下载接口。

## 通过配置切换存储

修改 `apps/server/.env` 中的 `STORAGE_DRIVER`，然后重启后端生效，配置不会热加载：

- `STORAGE_DRIVER=LOCAL_FS`：新上传使用本地存储，必须配置 `STORAGE_ROOT` 为后端运行环境中的绝对路径。
- `STORAGE_DRIVER=RUST_FS`：新上传使用 RustFS，必须配置 `STORAGE_ENDPOINT`、`STORAGE_BUCKET`、`STORAGE_ACCESS_KEY` 和 `STORAGE_SECRET_KEY`。

两套存储参数配置完整后，往返切换只需修改 `STORAGE_DRIVER` 并重启后端，不需要修改业务代码或前端。若部署环境已经设置同名环境变量，应修改该环境变量，它的优先级高于 `.env` 文件。

切换仅改变新建上传会话的默认存储，不会自动迁移已有文件或修改进行中的上传。访问历史文件仍需保留原本的本地目录或 RustFS 连接配置。

## 策略结构

```text
上传 / 媒体读取 / 后台处理 / 分享 / 回收站
                       ↓
                 StorageService
                       ↓
             StorageProviderRegistry
                  ↙           ↘
   LocalFsStorageProvider   RustFsStorageProvider
```

- `storage.provider.ts` 定义统一的 `StorageProvider` 接口：`put`、`read`、`stat`、`exists`、`delete`，以及存储位置、元数据和错误类型。`StorageType` 复用 Prisma 的 `StorageProviderType`，避免业务类型与数据库枚举漂移。
- `StorageProviderRegistry` 用 `Map<StorageType, StorageProvider>` 注册和选择策略，拒绝重复注册或未知类型。
- `StorageModule` 通过 NestJS Factory 注册 `strategies` 中的 Provider，注册完成后才构造 `StorageService`，不依赖初始化钩子的执行顺序。
- `StorageService.defaultLocation` 提供新上传使用的位置；`StorageService.for(location)` 根据已有记录选择 Provider，并检查存储桶是否匹配。业务层不导入具体 Provider，也没有按存储类型分支的读写逻辑。

实现位于 `apps/server/src/modules/storage/`。

## 连接本地 RustFS

### 1. 准备私有桶和凭据

使用已有 RustFS 部署，在控制台创建私有桶，例如 `image-stack`，并为应用创建访问凭据。

- 配置 **S3 API 地址**，不是控制台地址。RustFS 通常使用 `9000` 提供 S3 API、`9001` 提供控制台；以实际端口映射为准。
- 本项目语音服务的 `ASR_BASE_URL` 默认也使用 `9000`。下面示例假设 RustFS S3 API 映射到宿主机 `9002`，避免冲突；若实际使用 `9000`，请相应替换。
- 地址必须能从 **NestJS 服务所在环境** 访问。后端在容器中运行时，`127.0.0.1` 指向后端容器自身，应使用同网络的 RustFS 服务名或可访问的宿主机地址。WSL 与 Windows 分别部署时也需确认实际网络可达性。
- 应用凭据需允许该桶内对象的 `s3:GetObject`、`s3:PutObject`、`s3:DeleteObject`、`s3:AbortMultipartUpload`，以及该桶的 `s3:ListBucket`（用于容量统计，并正确区分对象不存在与无权访问）。创建、上传分段和完成 multipart 均使用 `s3:PutObject` 权限。
- 应用不会自动创建桶、修改桶策略或开启公开访问，不需要授予管理员权限。不要将密钥写入前端环境变量或提交到版本库。

### 2. 配置服务端环境

保留 `apps/server/.env` 中的数据库、Redis、RabbitMQ、JWT 等配置，调整存储部分：

```dotenv
STORAGE_DRIVER=RUST_FS
STORAGE_MAX_FILE_BYTES=1073741824
STORAGE_ACCESS_KEY=replace-with-your-access-key
STORAGE_SECRET_KEY=replace-with-your-secret-key
STORAGE_ENDPOINT=http://127.0.0.1:9002
STORAGE_BUCKET=image-stack
```

若已有本地文件，必须保留原来的 `STORAGE_ROOT`；只有全新、纯 RustFS 部署才可以留空或省略它。不要为了切换存储而删除旧目录。

| 变量                                        | 说明                                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `STORAGE_DRIVER`                            | 新上传的默认策略，取值为 `LOCAL_FS` 或 `RUST_FS`；默认 `LOCAL_FS`，修改后需重启后端。                                                  |
| `STORAGE_ROOT`                              | 本地存储的绝对路径；默认策略是 `LOCAL_FS` 时必填，历史本地文件仍需此配置。                                                             |
| `STORAGE_MAX_FILE_BYTES`                    | 存储层文件大小上限，默认 1 GiB；实际上传上限取它与 `ASSETE_SIZE`（非视频，默认 10MB）或 `VIDEO_ASSET_SIZE`（视频，默认 1GB）的较小值。 |
| `STORAGE_ENDPOINT`                          | HTTP/HTTPS 的 S3 API 根地址，不能包含桶路径、控制台路径、凭据、查询参数或片段。                                                        |
| `STORAGE_BUCKET`                            | 预先创建的私有桶名称，使用合法的小写 S3 桶名。                                                                                         |
| `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | 应用访问凭据，仅由服务端使用。                                                                                                         |
| `STORAGE_REGION`                            | 可选，默认 `us-east-1`，与服务端配置一致。                                                                                             |
| `STORAGE_FORCE_PATH_STYLE`                  | 可选，默认 `true`，使用 `endpoint/bucket/key`，适合本机 IP、localhost 和 Docker 服务名。只有配置好桶子域名访问时才设为 `false`。       |
| `STORAGE_REQUEST_TIMEOUT_MS`                | 可选，请求 socket 超时，默认 60000 ms，可配置 1000–600000 ms；不是整份大文件的总上传时限。                                             |

启用 `RUST_FS` 时，端点、桶名和两项凭据均必填，其余对象存储配置使用默认值即可。默认使用本地存储但仍需读取历史 RustFS 文件时，也应保留完整对象存储配置；只填写部分连接配置会在启动时校验失败。

### 3. 安装依赖与应用迁移

在项目根目录执行：

```sh
pnpm --dir apps/server install --frozen-lockfile
pnpm --dir apps/server run db:migrate
pnpm --dir apps/server run db:generate
pnpm --dir apps/server run start:dev
```

生产环境执行迁移、生成客户端后，按原部署流程重新构建并重启服务。

迁移 `20260913180000_rustfs_storage` 在存储枚举中增加 `RUSTFS`，并为 `UploadSession` 增加 `storageProvider`、`storageBucket`。已有上传会话回填为 `LOCAL_FS`；`FileNode` 沿用已有的存储位置字段。迁移不会移动或复制文件。

## 上传、读取与切换行为

- 新建上传会话时记录策略和桶；分片、断点续传、合并和清理始终使用会话记录的位置，重启或修改默认策略不会把旧分片合并到另一种存储。
- 原文件、缩略图、视频预览、HLS 播放列表及分段都使用所属文件的存储位置。图库、搜索、相册、分享、AI 索引和视频转写均支持两种策略。
- RustFS Provider 使用 AWS S3 SDK 签名请求，小文件使用条件 `PutObject`；超过 8 MiB 时使用 8 MiB 分段、最多两个并发分段的 multipart 上传，不缓存整份大视频。失败时尝试中止已创建的 multipart 上传。
- 对象键不可覆盖，写入使用 `If-None-Match: *`；Range 读取校验返回范围并保留完整对象大小，继续支持视频拖动播放。
- 下载仍经过后端鉴权并流式返回，存储桶不需要公开，前端不接触密钥，也不要求浏览器直连 RustFS 或新增桶 CORS 配置。
- 回收站和派生文件清理按“策略 + 桶 + 对象键”检查引用，避免误删另一种存储或共享副本仍使用的对象。
- 切换默认策略只影响新上传，不是数据迁移。恢复 `LOCAL_FS` 后，历史 RustFS 对象仍需原 RustFS 配置；反向切换时同理。不能直接修改数据库中的存储类型来迁移文件。
- 不要把端点或桶改成另一套未迁移的数据。已记录桶与当前配置不一致时会明确拒绝访问，不会回退到默认存储。
- 进程被强制终止或网络故障可能留下对象/未完成 multipart；应结合日志与 RustFS 的清理功能处理，并同时备份数据库和实际存储数据。

## 已用空间与总容量

侧栏和设置页通过 `GET /api/system/storage` 展示“已用 / 总容量”、使用率和剩余可用空间。接口需要登录及 `asset:list` 权限，不返回存储路径、桶名或凭据。容量请求独立于图库列表与账户统计；失败时保留已有数据并提供重试，不会阻止图片加载。

- `LOCAL_FS`：通过 `STORAGE_ROOT` 所在文件系统读取真实磁盘容量。已用空间为磁盘已分配空间，包含其他账户和应用；剩余空间为后端进程可用空间，系统预留空间可能导致“已用 + 可用”小于总量。
- `RUST_FS`：分页汇总当前桶中对象的实际字节数，包括原文件、派生文件和已写入的上传分片。回收站对象仍占空间；共享副本引用同一对象时只计算一次。不包含旧版本对象和未完成的 S3 multipart 分段，也不代表 RustFS 集群物理磁盘用量。
- S3 标准接口不提供桶的物理总容量，因此 RustFS 的总量由 `STORAGE_TOTAL_BYTES` 配置。该值为大于 0 且不超过 `9007199254740991` 的整数字节数，例如 `STORAGE_TOTAL_BYTES=107374182400` 表示 100 GB（按 1024 换算）。留空时显示“未配置”，不会填充虚假容量或显示误导性的使用率；本地磁盘不使用此配置。
- `STORAGE_TOTAL_BYTES` 只用于容量展示，不是上传配额限制；请按实际分配给桶的容量设置，修改后重启后端。已用量超过配置值时，仍显示真实用量，进度条最多为 100%，剩余为 0。
- RustFS 并发统计合并读取，成功结果缓存 30 秒，应用写入或删除对象后立即失效。前端每 30 秒校准容量，并在上传完成、永久删除后刷新；轮询遵守页面可见性和自动刷新设置。外部直接修改桶的结果可能延迟一个缓存窗口。

设置中的“图库原文件”和“回收站原文件”仍只统计当前账户。容量卡片统计当前默认存储磁盘或桶，不是个人配额；切换存储策略后，不会把另一种历史存储的大小混入当前容量。

## 验证连接

1. 使用有 `asset:list` 权限的账户读取 `/api/system/capabilities`（前缀以 `API_PREFIX` 为准），确认 `storageProvider` 为 `RUSTFS`、`storageProviders` 包含两种策略。此接口展示配置能力，不代表桶连接探测成功。
2. 上传一张新图片，确认能查看原图和缩略图，并在 RustFS 桶中看到 `originals/` 与 `derived/` 对象。
3. 上传超过 8 MiB 的视频，确认分片上传、后台处理、播放与拖动正常；临时分片位于 `uploads/`，合并完成后会清理。
4. 对无其他引用的文件执行移入回收站、永久删除，确认对应对象得到清理。
5. 若存在历史本地文件，切换默认策略后再次读取它们，确认保留的 `STORAGE_ROOT` 正确。

出现连接或权限错误时，优先检查 API/控制台端口、后端到 RustFS 的网络、桶是否已创建、凭据及桶权限。系统健康接口目前检查数据库和 Redis，不能代替实际上传验证。

## 添加下一种存储策略

1. 在 `apps/server/src/prisma/schema.prisma` 的 `StorageProviderType` 增加类型，生成对应迁移与 Prisma Client；`StorageType` 和支持类型列表会同步变化。
2. 新增实现 `StorageProvider` 的 NestJS Provider，提供 `type`、`bucket`、`space()` 容量统计和统一读写方法；保持对象不可覆盖、二进制流、大小限制和 Range 返回总大小的契约。不能获取总容量时返回 `null`，不要假定无限容量。
3. 将 Provider 加入 `StorageModule` 的 `strategies` 数组；如需连接参数，在服务端环境校验中声明。

不需要修改 `StorageService`、注册中心或上传、媒体处理、分享等业务服务，也不要为新类型添加业务层 `if/else`。
