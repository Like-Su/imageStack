# imageStack Web

沿用现有 Vue 3、TypeScript、Vue Router、Pinia、Tailwind CSS、VeeValidate 与 Zod 架构。认证和媒体库工作区均参照 `design/index.html`，不新增依赖、不注入演示媒体。

登录、注册和找回密码等认证页共用 `src/assets/auth-showcase.svg` 作为画廊背景，保留三列拼贴并用轻量渐变保证文字可读。SVG 只包含矢量图形和内部引用，不嵌入位图、不请求第三方图片，也不运行持续背景动画。`AuthLayout.vue` 通过 Vite 显式导入资源地址，以单个 `<img loading="lazy">` 展示并异步解码；左侧展示栏仅在桌面断点（`64rem` 起）显示，小屏隐藏时不触发图片懒加载。Vite 将 SVG 输出为单个带内容哈希的独立资源，便于缓存。

## 目录职责

- `src/api`：HTTP 请求、CSRF 签发与重试、响应解包、错误处理和认证接口。
- `src/components/auth`：原型双栏布局、字段、图形验证码、找回邮件表单、密码强度、条款弹窗及提示。
- `src/components/workspace`：可折叠侧栏、顶栏搜索、移动端抽屉导航、页面标题、弹窗、提示和上传队列。
- `src/components/media`：瀑布流/列表、带鉴权图片、详情抽屉、批量操作、相册与标签表单、媒体选择器。
- `src/composables`：验证码加载与原有主题、偏好设置逻辑。
- `src/config`：API 基址、超时和表单校验规则。
- `src/hooks`：VeeValidate 与 Zod 的表单适配。
- `src/router`：页面路由、登录守卫和站内回跳检查。
- `src/stores`：登录信息、令牌刷新、会话恢复与退出。
- `src/types`：与后端控制器对应的请求、响应和用户类型。
- `src/views`：认证页以及图库、相册、收藏、标签、搜索、人物、地点、任务、扩展、回收站与设置。

## 页面与行为

| 路径                              | 功能                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `/login`                          | 邮箱、密码和图形验证码登录；保持登录状态；跳转注册或找回密码                 |
| `/register`                       | 昵称、邮箱、密码确认、强度提示、验证码与条款确认；成功后提示邮箱激活         |
| `/forgot-password`                | 图形验证码验证、发送找回邮件、冷却倒计时、邮件验证码与新密码；成功后返回登录 |
| `/auth/verify-activate?token=...` | 消费邮件激活链接，显示激活结果                                               |
| `/`、`/library`                   | 受保护的图库工作区，登录后的默认入口                                         |
| `/settings#account`、`/account`   | 真实账户信息、重置密码、退出当前设备和所有设备                               |

同时支持 `/auth/login`、`/auth/register`、`/forget`、`/auth/forget`、`/auth/forgot-password`、`/auth/reset` 别名。

登录成功后先获取当前用户，再保存会话。勾选“保持登录状态”时使用 `localStorage`，否则使用 `sessionStorage`；不保存密码、图形验证码或邮件验证码。受保护请求携带 Bearer Token，401 时在当前页面内合并并发刷新请求并至多重试一次。延迟返回的旧会话请求不会覆盖新登录状态。网络或 CSRF 错误不会直接清空已有会话，登录页支持重新尝试恢复会话。注册成功不自动登录，因为后端要求先激活账户。

邮件激活与找回密码页面不依赖登录态恢复，即使已登录或旧令牌过期，也能打开邮件链接。链接里的 `token` / `emailCode` 读取后会从地址栏移除，仅保留在页面内存中；页面刷新后需重新打开邮件链接或粘贴验证码。页面和外部展示图片均禁用 Referrer，避免泄漏邮件凭据。

## 实际接口

默认基址为 `/api`，成功响应支持后端的 `{ success: true, data, timestamp }` 封装；错误展示后端业务消息，并统一处理断网、超时和限流。

| 方法 | 路径                     | 请求或返回                                                                             |
| ---- | ------------------------ | -------------------------------------------------------------------------------------- |
| GET  | `/auth/csrf`             | 自动获取 `{ csrfToken }` 与 HttpOnly Cookie                                            |
| GET  | `/auth/captcha`          | 返回 `{ captchaId, image }`；SVG 经清理后以图片显示                                    |
| POST | `/auth/login`            | `{ email, password, captcha, captchaId }` → `{ accessToken, refreshToken, expiresIn }` |
| POST | `/auth/register`         | `{ username, email, password, enterPassword, captcha, captchaId }`                     |
| POST | `/user/me`               | Bearer Token → 当前用户、角色及权限                                                    |
| POST | `/auth/forget/send-code` | `{ email, captcha, captchaId }` → `{ message, expiresIn, retryAfter }`，HTTP 202       |
| POST | `/auth/forget`           | `{ email, emailCode, password }`                                                       |
| POST | `/auth/reset`            | 同上，由 `/auth/reset` 页面别名使用                                                    |
| GET  | `/auth/verify-activate`  | 查询参数 `token`                                                                       |
| POST | `/auth/refresh`          | `{ refreshToken }` → 新令牌对                                                          |
| POST | `/auth/logout`           | Bearer Token 与 `{ refreshToken }`                                                     |
| POST | `/auth/logout-all`       | Bearer Token，撤销所有设备会话                                                         |

登录和注册尝试失败后会重新加载一次性图形验证码。新密码至少 8 位且不超过 bcrypt 的 72 字节限制；登录保留后端至少 6 位的兼容规则。登录仅提供后端实际支持的邮箱方式，OIDC / SSO、LDAP 保留原型外观但明确禁用。

## 组件、主题与国际化

### 管理员访问管理

管理员侧栏提供「用户管理」「角色管理」「权限管理」，对应 `/admin/users`、`/admin/roles`、`/admin/permissions`。支持用户分页搜索、创建/编辑/软删除、密码重设、角色分配与额外权限分配；角色和权限也支持创建、编辑和删除。页面复用 Element Plus 表格、表单、多选框、分页及原有主题桥接，所有界面提示支持中英文。

普通账户隐藏管理入口，直接访问管理路由会返回图库；后端独立执行管理员校验。每个用户保留一个角色，生效权限是角色权限与额外权限的并集；清空额外权限不会撤销角色继承权限。用户自定义名称及权限编码按原值展示，不翻译数据。

管理员不能删除/停用自己，内置角色与权限受保护，有关联用户的角色、有子权限的权限需先解除关联。修改当前账户或其角色后需要重新登录。删除用户保留媒体与邮箱，不代表物理删除其文件。使用前须执行服务端 `20260911200000_iam_user_permissions` 迁移，详见服务端 README。

### 组件集成

前端使用 Vue 3 对应的 **Element Plus**，不是 Vue 2 的 Element UI。Vite 通过 `unplugin-vue-components` 按需导入组件；全局只加载一份基础组件样式。弹窗、抽屉、消息、输入框、选择器、日期选择器、按钮、分段选择、开关和进度条复用组件库，媒体处理、上传和鉴权逻辑保持独立。

工作区使用 `ElContainer` / `ElAside` / `ElHeader` / `ElMain` 布局，侧栏菜单复用 `ElMenu` 的路由选中和折叠提示，并支持 Tab 聚焦、Enter / Space 导航。顶栏左侧按钮可将桌面侧栏在 248px 与 64px 图标栏之间切换，状态按账户保存到已有本地偏好，恢复默认设置会展开侧栏。移动端使用 `ElDrawer`，支持遮罩、Esc 和选择菜单后关闭；切换到桌面会自动关闭抽屉，不改变桌面折叠偏好。搜索框、任务徽标、头像和存储比例条同步复用 Element Plus，不新增依赖，管理员导航仍沿用角色检查。

主题仍由 `useTheme.ts` 管理 `media-hub.theme`、根节点 `theme-mode` 与系统主题监听。`src/assets/theme/element-plus.css` 将 Element Plus 的颜色变量映射到现有 `--app-*` 变量，连同挂载到 `body` 的弹层一起生效；不要引入 Element Plus 暗色样式或添加第二套 `dark` 类切换逻辑。

登录页和设置页提供简体中文 / English 切换，偏好保存于 `media-hub.locale`；本地存储不可用时仍可切换，但会提示无法持久保存。`vue-i18n` 管理应用文案，`ElConfigProvider` 同步组件库内置语言，日期、数字及排序也跟随所选语言。页面标题与表单校验会同步更新。

文案集中在 `src/i18n/messages.ts`，现有中文作为扁平消息键，中文资源由这些键生成；新增文案需同时填写英文，动态值使用 `{value1}` 等命名参数，避免拼接翻译。媒体名称、人工标签、AI 识图结果、服务端未知错误等用户或服务器内容保持原样，持久化的 `人物:` 标签前缀不会随语言变化。

在仓库根目录运行 `pnpm --dir apps/web exec vue-tsc --noEmit -p tsconfig.app.json` 检查类型，运行 `pnpm --dir apps/web build` 验证生产构建。

## CSRF 与找回密码流程

1. 首次写请求前，请求层自动获取 `/auth/csrf`，并合并同一页面内的并发获取请求；CSRF 令牌仅缓存于内存，不读取 HttpOnly Cookie。
2. 所有请求使用 `credentials: include`，写请求自动添加 `x-csrf-token`。仅遇到 `403 / CSRF_TOKEN_INVALID` 时重新签发并重试一次；其他 403、网络错误、超时不会自动重发业务请求。
3. 忘记密码页先提交邮箱和图形验证码。收到 HTTP 202 后进入设置新密码步骤，显示后端的统一受理提示；202 不代表邮件已经送达，也不暴露账户是否存在。
4. 重新发送遵循响应的 `retryAfter`，遇到 429 则使用 `details.retryAfter` 或 `Retry-After`；倒计时按截止时间计算。失败后刷新已消费的图形验证码，后端仍负责最终限流。
5. 邮件链接自动填入邮箱与验证码，也可选择“我已有验证码”手动粘贴。重置码为完整 64 位十六进制字符，通常 30 分钟内有效；确认密码只做前端校验，不发送给重置接口。
6. 只有后端返回重置成功后才显示完成页面并清除本机旧会话；后端同时撤销旧访问令牌与刷新令牌，用户需要用新密码重新登录。

退出接口失败时仍清除本机登录信息，但明确提示服务器注销未完成，不把本地清理当作服务端撤销成功。所有设备退出操作需要用户确认。

## 媒体库工作区

| 页面                          | 实际行为                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/`、`/favorites`             | 游标分页、瀑布流/列表、时间范围、最近 7 天、未分类（不属于相册）、大文件（≥ 5 MB）、年份、收藏切换与批量整理           |
| `/albums`、`/albums/:id`      | 创建/编辑/删除相册，按名称查找、数量排序，关联/移除图库媒体、设置封面；删除相册不删除原图                              |
| `/tags`、`/tags/:id`          | 标签计数、创建/改名/删除、同类合并、批量关联与解除关联                                                                 |
| `/search`（别名 `/aisearch`） | 真实关键词搜索、示例查询、条件筛选、分页及后端耗时；匹配文件名和手动标签，不模拟语义分数                               |
| `/people`、`/people/:id`      | 以 `人物:姓名` 标签实现可持久化的手动人物分组、照片关联、改名和合并；头像来自分组照片，不声称已做人脸识别              |
| `/places`                     | 读取 EXIF GPS，按 0.1° 聚合，显示坐标分布与对应图库；不调用外部地图、不伪造城市；概览最多 80 个点，列表最多 500 个分组 |
| `/tasks`                      | 真实入库状态统计、列表、尝试次数、错误与下一次重试时间；失败任务可重新入队，不展示虚构百分比，不提供假暂停/取消        |
| `/trash`                      | 分页浏览与详情、批量恢复、确认后永久删除；清空前收集 ID 并确认，以每批最多 100 项删除，失败显示部分完成结果            |
| `/plugins`                    | 从 `/system/capabilities` 获取能力清单，区分已内置和未接入，支持筛选与详情；不是在线安装器或运行健康探测               |
| `/settings`                   | 深浅/系统主题、网格密度、文件名显示、动画、自动刷新；只读服务器能力与存储统计；账户安全操作                            |

### 接口与请求处理

- 工作区 API 分别位于 `src/api/media.ts`、`src/api/system.ts`；结构类型位于 `src/types/media.ts`、`src/types/system.ts`。所有操作使用原请求层的 Bearer、CSRF、会话刷新及错误处理，不使用假数据兜底。
- `/assets` 与 `/assets/trash` 列表沿用后端游标，始终按上传时间倒序；时间筛选可选择上传或 EXIF 拍摄时间，日期按 UTC 处理。结束日期在前端转换为次日零点的排他上界。筛选在服务器执行，不只筛选已加载的部分记录。
- 缩略图、原图片/视频和兼容视频预览通过带鉴权的 `fetch` 获取 Blob，再生成临时对象 URL；不把令牌放进 URL。缩略图进入可见区域才请求，HTTP 202 按 `Retry-After` 有限重试。原文件需读取完成后才展示，大视频会显示等待状态；关闭蒙层取消请求、停止视频并释放对象 URL。
- 上传先 `POST /uploads/sessions`，再以原始 File 字节 `PUT /uploads/sessions/:id/content`，不是 multipart 或 JSON。最多两个并发；图片支持 JPEG/JFIF/PJPEG/PJP、PNG/APNG、WebP、GIF、AVIF、SVG，单张 ≤ 10 MiB；视频支持 MP4/MOV/MKV，单个 ≤ 512 MiB、4 小时。单帧 ≤ 2000 万像素，动图 ≤ 1000 帧；扩展名不区分大小写，服务器校验实际内容。SVG 限于安全静态图形与内联样式。
- 媒体详情的「查看原图片 / 查看原视频」打开原文件蒙层，底部提供放大、缩小、适应窗口、1:1 和下载；图片支持滚轮缩放、拖动平移，按 Esc 关闭。GIF/APNG 直接展示原始动画，SVG 只用 `<img>` 渲染。
- 视频使用原生播放器；MOV/MKV 或不兼容编码可通过 `GET /assets/:id/preview` 切换至后台生成的 H.264/AAC MP4，页面明确标注「非原文件」。下载始终取 `/assets/:id/file` 原文件，查看和下载均需要 `asset:download` 权限，回收站媒体需先恢复。服务端须配置 FFmpeg/ffprobe，未就绪时显示处理中，失败时可在任务中心重试。
- 上传异常时通过 `GET /uploads/sessions/:id` 查询最终状态；重试前再次核对，已完成的会话不重复上传，仍在接收的会话不另建副本。未开始的任务可取消；上传队列只存在内存，不支持分片续传或刷新后恢复。离开工作区后应先检查图库再重新上传。
- 页面操作按真实权限禁用或隐藏；后端所有资源访问仍按所有者和权限校验。初始化后的普通用户默认只有 `asset:list` / `asset:search`，上传、编辑、删除、相册、标签、下载需管理员按需授权。

### 能力与数据边界

- 语义模型、OCR、自动人脸识别、AI 相册推荐、S3、SSO、任务通知和自动备份未接入，页面明确说明并禁用相关开关；可用的替代能力是关键词搜索和手动人物/标签整理。
- 设置中的可写项都是浏览器偏好，不冒充服务器配置。除主题为浏览器共享外，偏好按账户保存。任务首页在可见标签页每 10 秒轮询；用户加载更多后不自动覆盖列表。侧栏统计每 30 秒刷新，可在设置关闭；关闭轮询不会暂停后端工作。
- 存储量仅为当前用户数据库中的原图片和原视频大小，包含单独标识的回收站用量，不代表磁盘总容量、NAS 状态、其他用户或派生文件用量。
- 回收站不会在 30 天后自动清空。永久删除先提交数据库关系删除，再清理无其他引用的存储对象；清理失败会返回 `cleanupPending` 并显示管理员处理提示，不宣称磁盘空间已全部释放。
- 保留原有账户/认证流程；工作区空库、加载、失败、无权限、无 GPS 等场景均有真实空态，不引用原型的占位照片、模拟用户或任务。

## 配置

参考 `apps/web/.env.example`，在 `apps/web/.env.local` 中配置：

```dotenv
FRONTEND_BACKEND_URL=http://localhost:3000
VITE_API_BASE_URL=/api
```

`FRONTEND_BACKEND_URL` 用于 Vite 的 `/api` 开发代理，也支持同名进程环境变量；`VITE_API_BASE_URL` 是浏览器请求基址。推荐使用相对路径 `/api`，通过同源代理自动保留 CSRF Cookie。生产部署应启用 HTTPS、将 `/api` 转发至后端，并为前端 History 路由配置 SPA fallback。

后端需要配置可用的 Redis、JWT 密钥及 SMTP；`APP_DOMAIN` 应指向前端地址，例如 `http://localhost:5173`，用于 `/auth/verify-activate` 与 `/forgot-password` 邮件链接。配置明细见 `apps/server/.env.example` 和 `apps/server/README.md`。

若将 `VITE_API_BASE_URL` 设为跨源 API 地址，后端 `CORS_ORIGIN` 必须包含准确的前端 Origin 并允许凭据，不能使用 `*`。当前 Cookie 使用 `SameSite=Lax`，应采用同源代理或同站部署，不支持互不相关站点之间直接携带这些 Cookie。生产环境保留 Secure Cookie，不通过关闭 CSRF 规避配置问题。

## 范围与检查

认证和工作区均接入真实接口，不模拟邮件发送、登录、重置或媒体操作成功。媒体工作区不加载第三方示例图片或地图；认证展示区使用本地单个 SVG 背景，无需访问外部图片服务。没有新增数据库模型、迁移或依赖。

前端可通过 `pnpm --dir apps/web build` 完成类型检查与生产构建。主题、语言切换、表单校验与弹窗交互可在开发服务器中验证；验证界面本身不需要调用真实 AI 服务或发送邮件。
