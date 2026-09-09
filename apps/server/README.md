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

| HTTP / code                     | 处理方式                                                                    |
| ------------------------------- | --------------------------------------------------------------------------- |
| `403 / CSRF_TOKEN_INVALID`      | 重新获取 CSRF 令牌，保留 Cookie，至多重试一次                               |
| `429 / PASSWORD_RESET_COOLDOWN` | 使用 `details.retryAfter` 或 `Retry-After` 响应头倒计时，随后刷新图形验证码 |
| `429 / HTTP_429`                | 命中接口 IP 限流，根据 `Retry-After` 等待                                   |
| `400 / PASSWORD_RESET_INVALID`  | 验证码过期、错误、已消费、账户不可用或会话版本变化，重新获取重置邮件        |
| `400 / HTTP_400`                | 表单校验或图形验证码失败，修正字段或重新获取图片                            |
| `401`                           | 登录状态失效，按原有认证流程刷新或重新登录                                  |

当前工作区的 `apps/web` 为模板文件，未保留此前的认证页面，本次未覆盖前端。接回页面时，发邮件请求只发送 `email/captcha/captchaId`，重置请求只发送 `email/emailCode/password`，并统一接入上述 CSRF 请求头和 Cookie。重置页面读取链接后应从地址栏清除验证码，并设置 `Referrer-Policy: no-referrer`，避免向外部图片或链接泄露验证码。

本次仅进行代码与接口约定的静态核对，未启动服务、发送实际邮件、运行测试、构建或类型检查。
