# 基础设施层

`infrastructure` 管理外部资源的连接、驱动、配置及通用读写能力。`modules` 管理业务规则和流程，`common` 保留跨模块的 HTTP 处理、DTO、业务常量及纯工具。基础设施不导入业务模块。

## 已抽离的能力

| 目录        | 职责                                                               | 原位置                              |
| ----------- | ------------------------------------------------------------------ | ----------------------------------- |
| `storage/`  | 本地文件系统、RustFS/S3 驱动、策略注册、存储路由和存储引用查询     | `modules/storage/`                  |
| `prisma/`   | PostgreSQL 连接、PrismaService、事务重试、schema、迁移及生成客户端 | `common/prisma/`、`src/prisma/`     |
| `redis/`    | Redis 配置、连接生命周期、基础命令及原子操作                       | `common/redis/`                     |
| `rabbitmq/` | RabbitMQ 连接配置、连接创建和关闭                                  | 原 `modules/jobs/` 中的连接管理     |
| `mail/`     | SMTP 连接配置、超时、发件人及通用邮件发送                          | 原 `modules/iam/auth/` 中的邮件传输 |

`AppModule` 通过 `InfrastructureModule` 装配基础设施。功能模块按需导入具体模块，例如 `JobsModule` 导入 `RabbitMqModule`，`AuthModule` 导入 `MailModule`。Prisma 和 Redis 延续原有全局模块约定；其他模块显式导入，不重复声明服务。

## 业务与基础设施的边界

- `MediaJobsService` 保留媒体消息格式、主队列/重试队列/失败队列声明、确认与重新投递、数据库补投及处理器调用。它向 `RabbitMqService` 申请连接，在停止消费、等待在途任务和关闭通道之后释放连接；基础设施在应用退出时兜底关闭剩余连接。
- IAM 的 `EmailService` 保留激活/密码重置模板、业务链接和有效期文案，通过 `MailService.send()` 发送内容。SMTP 配置不再放在 `AuthModule`。
- `common/constants/redis-key.ts` 定义认证、验证码和下载票据等业务键，因此继续放在业务公共常量中。
- 资产、相册、上传、权限、分享等服务保留业务查询和事务编排。抽离数据库连接不等于把所有使用 Prisma 的服务搬进基础设施。
- `storage-references.ts` 是共享对象清理前使用的持久化查询，跟随存储基础设施归档；它通过 Prisma 查询引用，不调用业务服务。

## 其他依赖的评估

以下代码同时包含外部调用和业务规则，适合在继续细分适配器时拆开，当前保留在原模块：

| 当前代码                                    | 可进一步抽离的部分                          | 应继续留在业务模块的部分                                 |
| ------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| `AiVisionService`、`VideoSummaryLlmService` | LLM 客户端创建、API 地址和超时配置          | 识图/总结提示词、输出结构、模型能力校验、结果清洗        |
| `VideoTranscriptionService`                 | ASR HTTP 请求、响应大小限制、取消及超时处理 | 音频分段、时间戳校验、转写检查点与断点续跑               |
| `VideoProcessorService`、`common/sharp.ts`  | FFmpeg/ffprobe 进程执行、Sharp 库适配       | 视频格式检查、缩略图规格、HLS 生成策略及媒体处理错误分类 |

JWT、CSRF、权限守卫、审计记录和响应封装分别属于认证、安全、业务审计及 HTTP 公共能力，当前不归入外部资源基础设施。

## Prisma 命令与部署

`apps/server/prisma7.config.ts` 已指向本目录的 `prisma/schema.prisma` 和 `prisma/migrations`。生成客户端仍使用 schema 相对路径 `./generated/prisma`，迁移内容和数据库模型未变。

原命令保持可用：

```bash
pnpm --dir apps/server run db:generate
pnpm --dir apps/server run db:migrate
pnpm --dir apps/server run db:seed
pnpm --dir apps/server run build
```

这次目录重构无需新增数据库迁移，也不迁移存储对象。部署时重新构建后端即可；不要继续使用引用旧源码路径的临时脚本。
