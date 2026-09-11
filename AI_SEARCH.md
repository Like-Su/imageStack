# LangChain 多模态识图与图片内容搜索

## 配置与启用

后端使用已有的 `@langchain/openai`、`@langchain/core` 和 Zod，不需要重新添加依赖。
识图优先使用 `OPENAI_API_VISION_MODULE` 指定的**视觉理解模型**；未配置时兼容旧 `OPENAI_API_MODULE`。模型标识会原样发送，不自动切换模型、服务地址或密钥。

在 `apps/server/.env` 中配置：

```dotenv
OPENAI_API_VISION_MODULE=填写已授权的视觉理解模型名
OPENAI_API_MODULE=
OPENAI_API_IMAGE_MODULE=
OPENAI_EMBEDDING=
OPENAI_API_KEY=填写服务商的密钥
OPENAI_BASE_URL=https://your-provider.example/v1
AI_AUTO_INDEX=true
AI_REQUEST_TIMEOUT_MS=60000
AI_INDEX_CONCURRENCY=1
```

`your-provider.example` 只是占位符，必须替换为**提供这个模型的服务商给出的 OpenAI 兼容 API 根地址**，不能根据模型名称猜测地址，也不要填写完整的 `/chat/completions` 路径。这里需要支持 Chat Completions、`image_url` 图片输入和 JSON object 输出的视觉模型。

非 OpenAI 模型未配置 `OPENAI_BASE_URL` 时，识图不会启动，也不会把第三方 API Key 发送到默认 OpenAI 服务。官方 `gpt-*`、`chatgpt-*`、`o1` 等模型可省略地址，使用 `https://api.openai.com/v1`。配置变化后需要重启后端。

四类配置分别是视觉理解 `OPENAI_API_VISION_MODULE`、文本对话 `OPENAI_API_MODULE`、图片生成 `OPENAI_API_IMAGE_MODULE` 和向量模型 `OPENAI_EMBEDDING`。只有支持图片输入的文本/多模态模型才适合作为旧配置的识图回退；图片生成和 Embedding 模型不会自动用于 Chat Completions 识图。部分 VL Embedding 模型支持图片输入，但输出仍是数值向量，不是画面描述或 OCR。当前改动只接收、校验这些配置，不代表图片生成或向量检索功能已经实现。

### 硅基流动：按任务选择接口

以下三类接口不是三个可以互换的识图模型：

- [图片生成接口](https://api-docs.siliconflow.cn/docs/api/images-generations-post)：`POST /v1/images/generations` 接收生成提示词，返回图片 URL；`Tongyi-MAI/Z-Image` 属于生图模型，不能替代视觉理解模型。
- [聊天与视觉输入接口](https://api-docs.siliconflow.cn/docs/api/chat-completions-post)：`POST /v1/chat/completions` 中的 `messages[].content` 使用 `image_url` 输入图片，由支持视觉输入的聊天模型输出描述、关键词和 OCR。现有识图链路使用这个接口，并保留文档支持的 `response_format: { "type": "json_object" }` 及本地 Zod 校验。
- [向量接口](https://api-docs.siliconflow.cn/docs/api/embeddings-post)：`POST /v1/embeddings` 返回数值向量。`Qwen/Qwen3-VL-Embedding-8B` 可使用 `input: { "image": "图片 URL 或 base64" }` 处理图片，但其结果不能当作识图 JSON。接入向量检索还需要独立的向量存储和查询链路。

例如，保留各模型的正确职责：

```dotenv
OPENAI_BASE_URL=https://api.siliconflow.cn/v1
OPENAI_API_MODULE=deepseek-ai/DeepSeek-V4-Flash
OPENAI_API_VISION_MODULE=Qwen/Qwen3-VL-8B-Instruct
OPENAI_API_IMAGE_MODULE=Tongyi-MAI/Z-Image
OPENAI_EMBEDDING=Qwen/Qwen3-VL-Embedding-8B
```

识图配置误填常见生图、Embedding 或 Reranker 模型时，会在本地给出配置错误，不再发送必然不兼容的识图请求。模型列表中可见不等于调用必定成功；服务商的数值错误码（如 `20012`、`50507`）会与 HTTP 状态一起保留，便于区分配置问题和可重试的服务故障。

本地配置完整、模型出现在服务商的模型列表中，都不代表当前 API Key 已获得调用权限。若返回 `403 / access_denied`，先确认密钥与 `OPENAI_BASE_URL` 的工作空间匹配、端点访问已授权，再检查模型权限或显式配置一个已授权的视觉理解模型。`Workspace endpoint access denied` 表示工作空间端点访问被拒绝，不是图片或 JSON 格式错误；修改 JSON 参数、填写 Embedding 模型或重新生成 Prisma Client 均不能修复授权失败。

在 **Windows 项目根目录**、与运行服务相同的 Node/pnpm 环境中执行：

```powershell
pnpm --dir apps/server run db:migrate
pnpm --dir apps/server run db:generate
pnpm --dir apps/server run start:dev
```

新增迁移为 `20260910220000_ai_image_recognition`，只新增独立的 `AssetRecognition` 表、外键和任务状态索引，不改动人工标签或原始媒体。不要执行 `prisma migrate reset`。迁移必须应用到后端实际使用的数据库。

### 识图队列告警排查

- 队列告警来自数据库轮询，发生在调用视觉模型之前，不代表 API Key 或模型请求失败。
- 出现 `P2021`（缺表）或 `P2022`（缺字段）时，在运行后端的同一环境、项目根目录执行 `pnpm --dir apps/server run db:migrate`。Windows 后端的 `localhost` 和 WSL 的 `localhost` 可能连接不同的 PostgreSQL，不能用另一个环境的迁移成功代替检查实际数据库。
- 如果 Prisma 客户端尚未同步 schema，再执行 `pnpm --dir apps/server run db:generate` 并重启后端；其他错误根据日志中的错误码检查 `DATABASE_URL`、数据库服务和连接权限。
- Worker 保持每 5 秒检查队列，同一类故障每分钟最多告警一次，查询恢复后输出“识图队列已恢复”。修复缺表时无需清空队列或重置数据库。

### 识图请求失败排查

- 图片详情记录本次任务实际使用的模型；失败信息保留 HTTP 状态和安全的服务商错误码，不输出密钥、图片请求体或原始供应商错误文本。
- `401` 检查密钥和服务地址；`403` 检查密钥与工作空间端点匹配及模型调用权限；`404` 检查模型名称和接口路径；`400 / 422` 检查视觉输入及 JSON 输出支持；`429` 检查额度和限流。
- 配置或授权修复后重启后端，再在图片详情点击重试，或在搜索页补建索引。失败任务不会仅因修改 `.env` 自动重新入队，已有成功结果也不会自动重新收费识别。

## 工作流程

- 新图片的原有 RabbitMQ 媒体任务完成后，将识图任务写入数据库。`AI_AUTO_INDEX=false` 可以关闭新图片自动入队，手动识图仍可使用。
- AI worker 独立消费数据库中的任务，默认并发 1，每 5 秒检查一次，不占用视频转码队列的执行槽。任务状态为 `PENDING / PROCESSING / READY / FAILED`。
- 每个任务使用带令牌的 3 分钟租约，定期续期；服务重启后可恢复过期任务。瞬时故障最多尝试 3 次，并退避重试；认证、模型或原文件错误会明确失败。AI 失败不会把已经可用的媒体改为处理失败。
- 识图读取本人图片，检查原文件与格式限制，转为最长边 1536px、最大 2 MiB 的 JPEG，再通过 LangChain 发送 Base64 图片。不会把文件名、用户标识、EXIF 或磁盘路径放入模型请求。
- 模型生成中文画面描述、简短中英文关键词及可辨文字。输出经过结构及长度校验后存储，成功结果不会因重复投递重复识别；人工标签保持不变。
- 已有图片**不会在启动时全库识别**。在搜索页点击“补建索引 / 重试失败”，确认外部调用及费用后，每次最多加入 100 张未索引或失败图片。图片详情也可单独触发。
- 搜索页显示当前配置、已识图/等待/处理中/失败数量；图片详情显示描述、关键词、OCR 文字、模型及错误。

图片会发送到你配置的外部 AI 服务，可能包含私人内容并产生费用；使用前请确认服务商的数据政策和账户额度。API Key 只由后端读取，不返回前端，也不输出模型请求体或原始供应商错误。识图记录随原资产永久删除而级联删除，回收站图片不参与识图和搜索。

## 检索语义

仍使用现有 `GET /api/search?mode=keyword&q=海边%20日落` 接口。每个关键词可匹配文件名、手动标签，或已经完成的 AI 描述、关键词及 OCR；多个关键词为 AND 关系，保留所有权、删除状态、相册、时间等过滤及游标分页。查询只访问数据库，不会每次搜索都调用大模型。

这实现的是**多模态理解图片后，对识图文本进行检索**，不是向量相似度搜索，也不会返回伪造的相似度分数。没有额外假设或调用 Embedding 模型。长自然语言问题建议提取成几个画面关键词。

当前只识别图片；动画取首帧，视频仍按原文件名和人工标签搜索。OCR 受缩放、图像清晰度和模型能力影响，结果可能出错；不自动推断人物姓名、敏感属性或现实身份。

## 接口

所有接口沿用登录认证、CSRF 保护及当前用户的资源范围。

| 接口                                              | 权限           | 行为                                                |
| ------------------------------------------------- | -------------- | --------------------------------------------------- |
| `GET /api/ai/status`                              | `asset:search` | 配置状态及当前用户可识别图片的任务统计，不包含密钥  |
| `GET /api/ai/assets/:id`                          | `asset:list`   | 自己的未删除图片识图结果；尚未入队时为 `null`       |
| `POST /api/ai/index`，JSON `{}`                   | `asset:edit`   | 排队最多 100 张未索引或失败的、媒体处理已完成的图片 |
| `POST /api/ai/index`，JSON `{"ids":["asset-id"]}` | `asset:edit`   | 指定本人图片；已有成功或进行中的任务不重复排队      |

提示 `AI_NOT_CONFIGURED` 时补齐模型、密钥及服务地址；提示数据表不存在时先执行数据库迁移。识图成功后，无需修改文件名，即可用画面中的物体、颜色、场景或文字搜索。

图片输入格式参考 [OpenAI 官方图片与视觉文档](https://developers.openai.com/api/docs/guides/images-vision)。兼容服务商是否支持指定模型及 JSON 输出，需要以该服务商实际能力为准。
