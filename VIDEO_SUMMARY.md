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
  → 鉴权 SSE 推送 → 前端提示“视频总结完毕：文件名”并刷新视频摘要
```

- 不在上传 HTTP 请求中执行模型调用，不占用 RabbitMQ 媒体转码队列的执行槽。转码和语音总结独立运行，摘要失败不会阻止视频播放。
- 默认并发 1、最多自动尝试 3 次。数据库租约避免重复执行，服务重启或 worker 中断后可恢复任务。
- 转写按 5 分钟分段持久化；转写服务失败后保留已完成的分段。总结失败保留完整转写，手动重试不会重新调用 ASR。
- 秒传和重复完成请求不会重新总结已经成功的视频。已有视频不会批量自动补建，可在视频详情手动启动。
- 无音轨或没有可识别语音时返回明确说明，不调用 LLM 编造摘要。
- 转写包含原语言及分段时间戳；中英夹杂、口音、背景音乐和噪声可能影响准确率。分段边界可能切断词句，请以原视频为准。
- 原视频不修改，临时音频在处理结束或失败时清理。资源上限沿用 512 MiB / 4 小时，另限制单段音频、ASR 响应、转写总长度和模型请求时长。
- 回收站视频不再被 worker 选取、不允许读取或接收完成通知；永久删除会级联删除转写、摘要及其事件。

## 接口

所有接口沿用后端 API 前缀、Bearer 登录认证与所有权限制，写接口沿用 CSRF 保护。

| 方法 | 路径                                       | 权限         | 用途                                                       |
| ---- | ------------------------------------------ | ------------ | ---------------------------------------------------------- |
| GET  | `/api/video-summaries/assets/:id`          | `asset:list` | 读取配置状态、任务阶段、转写、摘要和错误                   |
| POST | `/api/video-summaries/assets/:id`          | `asset:edit` | 为未处理视频排队，或重试失败任务；返回 202 与 `{ queued }` |
| GET  | `/api/video-summaries/events?after=事件ID` | `asset:list` | SSE 完成 / 失败通知，支持 `Last-Event-ID`                  |

任务状态使用 `PENDING / PROCESSING / READY / FAILED`，阶段为 `TRANSCRIBING / SUMMARIZING`。失败后读取接口仍可返回已完成的转写。

SSE 使用 `connected`、`heartbeat`、`video-summary` 事件。完成事件只包含事件 ID、视频 ID、文件名和状态，不传输整份转写。首次连接从当前事件位置开始，不弹出历史通知；当前浏览器会话保存按用户隔离的游标，刷新或断线后补收后续事件。新浏览器会话仍可在视频详情读取已完成的摘要。

事件与结果在同一事务提交；事件序号分配串行化，避免并行任务提交乱序导致跳过事件。服务端每 3 秒读取新增事件并通过 SSE 推送，15 秒发送心跳，最长 55 秒结束连接以重新鉴权；前端自动重连并刷新过期令牌。通知只发给视频所有者，登出或切换用户会关闭旧连接。

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
