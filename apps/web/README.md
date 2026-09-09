# imageStack Web

沿用现有 Vue 3、TypeScript、Vue Router、Pinia、Tailwind CSS、VeeValidate 与 Zod 架构。认证界面参照 `design/index.html`，不新增依赖。

## 目录职责

- `src/api`：HTTP 请求、响应解包、错误处理和认证接口。
- `src/components/auth`：原型双栏布局、字段、图形验证码、密码强度、条款弹窗及提示。
- `src/composables`：验证码加载与原有主题、偏好设置逻辑。
- `src/config`：API 基址、超时和表单校验规则。
- `src/hooks`：VeeValidate 与 Zod 的表单适配。
- `src/router`：页面路由、登录守卫和站内回跳检查。
- `src/stores`：登录信息、令牌刷新、会话恢复与退出。
- `src/types`：与后端控制器对应的请求、响应和用户类型。
- `src/views`：登录、注册、忘记密码、邮箱激活及已登录入口。

## 页面与行为

| 路径                              | 功能                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| `/login`                          | 邮箱、密码和图形验证码登录；保持登录状态；跳转注册或找回密码             |
| `/register`                       | 昵称、邮箱、密码确认、强度提示、验证码与条款确认；成功后提示邮箱激活     |
| `/forgot-password`                | 邮箱、完整邮件验证码、新密码与密码确认；成功后返回登录                   |
| `/auth/verify-activate?token=...` | 消费邮件激活链接，显示激活结果                                           |
| `/`                               | 受保护的已登录入口，展示真实账户信息并支持退出；后续可替换为媒体库工作区 |

同时支持 `/auth/login`、`/auth/register`、`/forget`、`/auth/forget`、`/auth/forgot-password`、`/auth/reset` 别名。

登录成功后先获取当前用户，再保存会话。勾选“保持登录状态”时使用 `localStorage`，否则使用 `sessionStorage`；不保存密码、图形验证码或邮件验证码。受保护请求携带 Bearer Token，401 时合并并发刷新请求并至多重试一次。注册成功不自动登录，因为后端要求先激活账户。

## 实际接口

默认基址为 `/api`，成功响应支持后端的 `{ success: true, data, timestamp }` 封装；错误展示后端业务消息，并统一处理断网、超时和限流。

| 方法 | 路径                    | 请求或返回                                                                             |
| ---- | ----------------------- | -------------------------------------------------------------------------------------- |
| GET  | `/auth/captcha`         | 返回 `{ captchaId, image }`；SVG 经清理后以图片显示                                    |
| POST | `/auth/login`           | `{ email, password, captcha, captchaId }` → `{ accessToken, refreshToken, expiresIn }` |
| POST | `/auth/register`        | `{ username, email, password, enterPassword, captcha, captchaId }`                     |
| POST | `/user/me`              | Bearer Token → 当前用户、角色及权限                                                    |
| POST | `/auth/forget`          | `{ email, emailCode, password }`                                                       |
| POST | `/auth/reset`           | 同上，由 `/auth/reset` 页面别名使用                                                    |
| GET  | `/auth/verify-activate` | 查询参数 `token`                                                                       |
| POST | `/auth/refresh`         | `{ refreshToken }` → 新令牌对                                                          |
| POST | `/auth/logout`          | Bearer Token 与 `{ refreshToken }`                                                     |

登录和注册尝试失败后会重新加载一次性图形验证码。新密码至少 8 位且不超过 bcrypt 的 72 字节限制；登录保留后端至少 6 位的兼容规则。登录仅提供后端实际支持的邮箱方式，OIDC / SSO、LDAP 保留原型外观但明确禁用。

## 配置

`apps/web/.env` 可配置：

```dotenv
FRONTEND_BACKEND_URL=http://localhost:3000
VITE_API_BASE_URL=/api
```

`FRONTEND_BACKEND_URL` 用于 Vite 的 `/api` 开发代理，也支持同名进程环境变量；`VITE_API_BASE_URL` 是浏览器请求基址。生产部署应将 `/api` 转发至后端，并为前端 History 路由配置 SPA fallback。后端 `APP_DOMAIN` 应指向可访问前端激活页面的地址。

## 当前后端对接限制

本次只修改 `apps/web`，不修改服务端。以下限制来自当前后端实现，并非通过模拟成功或虚构接口规避：

1. **缺少找回邮件发送入口**：`AuthService.sendResetPasswordMail` 未暴露为控制器路由，方法目前也未调用邮件服务。忘记密码页只对接已有的验证码提交接口，并明确提示联系管理员；未添加无效的“发送成功”交互。
2. **CSRF 流程尚未完成**：`apps/server/src/main.ts` 已全局启用 `doubleCsrfProtection`，但当前未提供 CSRF token 签发和前端传递约定。后端需完成适用于 Bearer API 的保护策略，或提供签发接口后再在请求层接入；当前前端不绕过 CSRF 校验。这可能阻止现有 POST 接口请求。
3. **密码重置后端闭环**：现有 `forgetPassword` 尚未等待密码修改完成，也未消费重置验证码；实际部署前应在后端补齐，避免提前响应与验证码重复使用。
4. **展示图片**：左侧展示区沿用原型的 Picsum 外部图片，字体与图标使用项目内资源。完全离线部署时，应将展示图片替换为 `src/assets/img` 内的本地资源。

按需求未启动项目、未执行测试、构建或类型检查。
