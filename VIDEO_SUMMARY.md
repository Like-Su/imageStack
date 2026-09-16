# 视频语音转写与总结

视频上传完成后，后台自动提取音轨，调用本地 Whisper ASR Webservice 转写中英文语音，再调用已有的文本模型生成中文摘要。前端收到“视频总结完毕”通知后，可在视频详情查看摘要和带时间戳的原语言转写。

这是**基于语音的总结**，不是视频画面理解：不会进行关键帧识别、画面 OCR 或人物身份推断。当前摘要和转写不参与图库关键词搜索。

## 部署

1. 启动 Whisper ASR Webservice，推荐 `ASR_ENGINE=faster_whisper`、多语言 `ASR_MODEL=small`。不要选择 `.en` 纯英文模型。CPU 可以运行，长视频建议使用 GPU。
2. 后端环境安装 FFmpeg / ffprobe，沿用现有 `FFMPEG_PATH`、`FFPROBE_PATH`。
3. 配置后端环境变量：

```dotenv
ASR_BASE_URL=http://127.0.0.1:9000
ASR_REQUEST_TIMEOUT_MS=1800000
VIDEO_SUMMARY_AUTO=true
VIDEO_SUMMARY_MODEL=
VIDEO_SUMMARY_CONCURRENCY=1
VIDEO_SUMMARY_REQUEST_TIMEOUT_MS=120000

OPENAI_API_MODULE=你的文本模型名称
OPENAI_API_KEY=你的模型服务密钥
OPENAI_BASE_URL=你的模型服务API根地址
```

`ASR_BASE_URL` 填写服务根地址，**不是** `http://localhost:9000/docs#/` 或 `/asr`。后端通过 `POST /asr` 上传 `audio_file`，指定 `task=transcribe`、`output=json` 和 `vad_filter=true`；不固定 `language`，每段自动检测语言，不把英文转写翻译成中文。

`VIDEO_SUMMARY_MODEL` 为空时复用 `OPENAI_API_MODULE`，密钥与根地址复用已有配置，不会使用识图或 Embedding 模型代替文本模型。未配置文本模型时，自动任务保留为待处理，视频详情显示配置提示；补齐配置并重启后端即可继续。

`localhost` 指**后端进程所在的网络环境**。后端若也运行在 Docker，应通过同一 Docker 网络内的服务名访问 ASR，不能直接使用容器自己的 `localhost`。浏览器无需直接访问 ASR，也不要将无鉴权的 ASR 端口公开到互联网。

4. 应用数据库迁移并生成客户端，然后重启后端：

```bash
pnpm --dir apps/server run db:migrate
pnpm --dir apps/server run db:generate
```

新增迁移：`20260913120000_video_summaries`。它仅新增视频摘要、完成事件表及阶段枚举，不改动现有媒体内容。

## 后台流程

```text
上传校验与落盘
  → 同一数据库事务中创建视频和 VideoSummary(PENDING)
  → 独立 worker 抢占带租约的任务
  → FFmpeg 提取 16 kHz 单声道 PCM 音频，每段最多 5 分钟
  → 本地 ASR 转写，每完成一段保存文字、时间戳和进度
  → 长文本分段总结，再逐层合并成完整摘要
  → 同一事务提交 READY 和完成事件
  → PostgreSQL NOTIFY 唤醒 SSE → 直接推送状态和摘要，前端提示“视频总结完毕：文件名”
```

- 不在上传 HTTP 请求中执行模型调用，不占用 RabbitMQ 媒体转码队列的执行槽。转码和语音总结独立运行，摘要失败不会阻止视频播放。
- 默认并发 1、最多自动尝试 3 次。数据库租约避免重复执行，服务重启或 worker 中断后可恢复任务。
- 转写按 5 分钟分段持久化；转写服务失败后保留已完成的分段。总结失败保留完整转写，手动重试不会重新调用 ASR。
- 秒传和重复完成请求不会重新总结已经成功的视频。已有视频不会批量自动补建，可在视频详情手动启动。
- 无音轨或没有可识别语音时返回明确说明，不调用 LLM 编造摘要。
- 转写包含原语言及分段时间戳；中英夹杂、口音、背景音乐和噪声可能影响准确率。分段边界可能切断词句，请以原视频为准。
- 原视频不修改，临时音频在处理结束或失败时清理。原视频大小上限读取服务端 `VIDEO_ASSET_SIZE`（默认 1GB，支持 B/MB/GB），不设置视频时长上限；仍限制单段音频、ASR 响应、转写总长度和模型请求时长。
- 回收站视频不再被 worker 选取、不允许读取或接收完成通知；永久删除会级联删除转写、摘要及其事件。

## 接口

所有接口沿用后端 API 前缀、Bearer 登录认证与所有权限制，写接口沿用 CSRF 保护。

| 方法 | 路径                                       | 权限         | 用途                                                                                    |
| ---- | ------------------------------------------ | ------------ | --------------------------------------------------------------------------------------- |
| GET  | `/api/video-summaries/assets/:id`          | `asset:list` | 读取配置与结果；`includeTranscript=false` 跳过转写正文及时间戳，默认 `true` 保持兼容    |
| POST | `/api/video-summaries/assets/:id`          | `asset:edit` | 为未处理视频排队，或重试失败任务；返回 202 与 `{ queued, detail }`，`detail` 为轻量状态 |
| GET  | `/api/video-summaries/events?after=事件ID` | `asset:list` | SSE 排队、转写进度、总结阶段及完成 / 失败通知，支持 `Last-Event-ID`                     |

任务状态使用 `PENDING / PROCESSING / READY / FAILED`，阶段为 `TRANSCRIBING / SUMMARIZING`。失败后读取接口仍可返回已完成的转写。

SSE 使用 `connected`、`heartbeat`、`video-summary` 事件。状态事件包含事件 ID、视频 ID、文件名、事件状态和轻量 `result`（状态、阶段、已转写分段数、摘要、错误及 `updatedAt` 等），不传输整份转写或时间戳数组。首次连接从当前事件位置开始，不弹出历史通知；当前浏览器会话保存按用户隔离的游标，刷新或断线后补收后续事件，同一批次同一视频的更新合并为最新状态。

事件、结果和 PostgreSQL `NOTIFY` 在同一事务提交；事件序号分配按用户锁串行化，避免同用户并行任务提交乱序导致跳过事件，不再让所有用户竞争同一独占锁。每个服务进程仅使用一条 PostgreSQL `LISTEN` 连接，收到提交通知后按所有者唤醒相应 SSE 流，100ms 内的连续通知合并读取；相同用户/游标的在途查询复用，每轮最多读取 5 批、每批 50 条，再让出执行继续追赶。监听连接断开会退避重连并补读已提交事件，支持多进程部署。`DATABASE_URL` 需连接支持会话级 `LISTEN/NOTIFY` 的 PostgreSQL，若使用事务池化代理，需要改用直连或会话池化连接。

同一 SSE 还可发送 `workspace-changed`，仅通知图片识别、媒体任务及统计等资源失效，不影响视频游标，也不包含转写全文。`connected` 的 `workspaceUpdates: true` 表示支持此能力；前端按 5 秒窗口合并这些资源的状态校准，连接正常时以 5 分钟低频读取兜底，视频完成提示不等待该窗口。没有为每张图片或每个面板新增连接。

SSE 每 15 秒发送心跳，不再每 55 秒强制断开；到 access token 过期时才重连刷新令牌。长连接期间每 45 秒复核会话版本、登出标记、账户状态及读取权限，失效时关闭连接。通知只发给视频所有者，登出或切换用户会关闭旧连接。前端超时基于连续 45 秒未收到事件，而非连接总时长；异常重连采用指数退避和随机抖动，遵守 `Retry-After`，离线时暂停重连，不放宽现有接口限流。

### 前端请求边界

- 一个工作区共享一条 SSE 连接。视频面板取消每 5 秒轮询，进度和摘要直接由事件更新；不再收到任意视频事件就全局刷新所有视频摘要。
- 首次打开、重连时必要的状态同步和用户手动刷新才读取轻量结果；首次读取短暂等待 SSE 建立，避免初始化重复请求。同一会话、同一视频的并发读取合并，事件与响应按 `updatedAt` 避免旧结果覆盖新状态。
- 完整转写只在用户展开时读取并缓存，收起、关闭详情或切换视频会取消未完成的读取。处理中不随每个分段重复下载累计全文，可手动加载最新内容；展开状态下转写完成或任务结束时仅按需补齐新内容。
- 手动开始或重试直接使用 POST 返回的状态，不再额外 GET。断线时不会回退为定时轮询，页面提示连接状态并保留手动刷新入口。

复用现有 `VideoSummary` / `VideoSummaryEvent` 表和 `pg` 依赖，不需要新增数据库迁移；先部署后端再部署前端。事件锁从单键改为按用户双键后，应停止旧版本任务写入者并统一切换所有 API/worker，不能混跑两种锁协议。分块转写存储、事件保留期及跨标签页单连接尚未实施，详见 [性能优化记录第 9 节](docs/性能优化.md#9-2026-09-13-优化实施记录)。

反向代理需要关闭 SSE 响应缓冲，并将读取超时设置为至少 75 秒。例如：

```nginx
location /api/video-summaries/events {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 90s;
}
```

## 隐私与排错

音频发往 `ASR_BASE_URL`，**转写文字会发往 `OPENAI_BASE_URL` 指定的模型服务**，可能包含私人内容并产生调用费用。只有 ASR 本地部署不代表总结也在本地；若要求全部离线，需要同时部署兼容聊天接口的本地文本模型。服务密钥不返回前端，日志不记录音频、转写正文或原始模型响应。

- 查看 ASR 状态：`docker logs -f local-asr`；首次启动需完成模型下载。
- 连接错误：确认后端所在环境能访问 `ASR_BASE_URL/openapi.json`，并检查 Docker 网络。
- 视频详情显示配置错误：检查文本模型、密钥、根地址，或迁移是否应用到后端实际连接的数据库。
- CPU 转写超时：调高 `ASR_REQUEST_TIMEOUT_MS`，或更换更小模型 / GPU；并发不要超过 ASR 服务和机器承载能力。
- 转写完成但总结失败：检查文本模型权限、额度、接口兼容性和超时后，在视频详情重试。
- 没有弹出通知：检查 `/api/video-summaries/events` 是否为 `text/event-stream`，反向代理是否缓冲、账号是否有 `asset:list` 权限。
- 禁用后续上传的自动处理：设置 `VIDEO_SUMMARY_AUTO=false` 并重启。已经排队的任务仍会执行，也可以手动启动。
