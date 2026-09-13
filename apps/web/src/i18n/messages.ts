export const english: Record<string, string> = {
  "本地中英文转写与视频语音摘要。":
    "Local Chinese and English transcription with video speech summaries.",
  "上传完成后独立进行音轨提取、分段转写与 AI 总结，保存原语言文字及时间戳。需要配置 ASR 服务和文本模型；失败可在视频详情重试。摘要不包含画面分析，当前不参与关键词搜索。":
    "Extracts audio, transcribes segments, and summarizes speech in the background after upload. Original-language text and timestamps are saved. Requires ASR and a text model; retry failures in video details. Visual analysis and keyword indexing are not included.",
  "视频转写与总结完成通知。":
    "Video transcription and summary completion notifications.",
  "通过鉴权 SSE 向视频所属用户推送总结完成或失败消息，断线后可从当前浏览器会话的游标补收。其他任务通知与 Webhook 尚未接入；SMTP 仍仅用于账户邮件。":
    "Authenticated SSE sends video summary completion or failure events to the owner and resumes from this browser session's cursor after reconnection. Other task notifications and webhooks are not implemented; SMTP remains for account emails only.",
  "视频总结完毕：{value1}": "Video summary complete: {value1}",
  "视频总结失败：{value1}，可在详情中重试":
    "Video summary failed: {value1}. Retry from its details.",
  视频语音总结: "Video speech summary",
  刷新视频总结: "Refresh video summary",
  "转写并总结视频？": "Transcribe and summarize this video?",
  "音频将发送到配置的语音转写服务，转写文字将发送到 AI 服务生成摘要，可能产生模型调用费用。":
    "Audio is sent to the configured transcription service, then the transcript is sent to the AI service for summarization. Model usage may incur charges.",
  开始视频总结: "Summarize video",
  重试视频总结: "Retry video summary",
  视频已进入后台转写与总结队列:
    "Video queued for background transcription and summarization",
  "语音转写完成，正在生成视频总结…":
    "Transcription complete. Generating the video summary…",
  "正在提取音频并转写中英文语音…":
    "Extracting audio and transcribing Chinese and English speech…",
  "已进入视频总结队列，等待后台处理…":
    "Queued for background video summarization…",
  "视频总结失败，已完成的转写会保留，可重试。":
    "Video summarization failed. Saved transcription is retained for retry.",
  "正在读取视频总结…": "Loading video summary…",
  "尚未生成视频总结，可手动开始转写与总结。":
    "No video summary yet. You can start transcription and summarization manually.",
  "查看语音转写（保留原语言）": "View transcript (original language)",
  "转写尚未完成，以下为已保存的部分内容。":
    "Transcription is incomplete. Saved progress is shown below.",
  显示更多转写内容: "Show more transcript",
  "摘要基于视频语音，不包含画面理解；转写和 AI 总结可能有误，请以原视频为准。":
    "This summary covers speech, not visual content. Transcription and AI summaries may contain errors; refer to the original video.",
  访问管理: "Access management",
  用户管理: "User management",
  角色管理: "Role management",
  权限管理: "Permission management",
  创建用户: "Create user",
  编辑用户: "Edit user",
  创建角色: "Create role",
  编辑角色: "Edit role",
  创建权限: "Create permission",
  编辑权限: "Edit permission",
  "管理账户、角色与访问权限": "Manage accounts, roles, and access permissions",
  "仅管理员可管理访问权限。内置角色和权限不能删除，内置编码不可修改。":
    "Only administrators can manage access. Built-in roles and permissions cannot be deleted, and their codes cannot be changed.",
  仅管理员可访问: "Administrators only",
  用户名称: "Username",
  角色名称: "Role name",
  角色编码: "Role code",
  角色说明: "Role description",
  权限名称: "Permission name",
  权限编码: "Permission code",
  父级权限: "Parent permission",
  无父级权限: "No parent permission",
  账户状态: "Account status",
  启用: "Enabled",
  停用: "Disabled",
  角色权限: "Role permissions",
  启用角色: "Enable role",
  用户额外权限: "Additional user permissions",
  额外权限: "Additional permissions",
  生效权限: "Effective permissions",
  生效权限预览: "Effective permission preview",
  未生效: "Inactive",
  未分配任何权限: "No permissions assigned",
  编辑与授权: "Edit & assign",
  "请选择角色后查看生效权限。":
    "Select a role to preview effective permissions.",
  "账户或角色停用时，所有授权均不生效。":
    "No permissions take effect while the account or its role is disabled.",
  "修改权限编码后，关联账户需要重新登录。":
    "Changing a permission code requires affected accounts to sign in again.",
  搜索并选择权限: "Search and select permissions",
  选择权限: "Select permissions",
  角色已有: "Inherited from role",
  "生效权限为角色权限与额外权限的并集；清空额外权限不会移除角色已有权限。":
    "Effective permissions combine role permissions and additional grants. Clearing additional grants does not remove permissions inherited from the role.",
  查看角色继承权限: "View inherited role permissions",
  "管理员角色始终拥有全部操作权限，不受勾选权限限制。":
    "The administrator role always has full access, regardless of the selected permissions.",
  "层级仅用于整理，不会自动授予子权限。新增编码需要业务接口接入后才能控制对应操作。":
    "The hierarchy is for organization only and does not grant child permissions. New codes must be checked by business endpoints before they can control operations.",
  "新密码（留空保持不变）": "New password (leave blank to keep)",
  初始密码: "Initial password",
  "保存用户或角色更改后，相关账户需要重新登录；若修改当前账户，将退出本次登录。":
    "Saving user or role changes requires affected accounts to sign in again. Changes affecting your account will sign you out.",
  请输入用户名称: "Enter a username",
  "密码至少 8 位且不能超过 72 字节":
    "Passwords must have at least 8 characters and no more than 72 bytes",
  请选择角色: "Select a role",
  请输入角色名称: "Enter a role name",
  "角色编码须以 ROLE_ 开头，仅含大写字母、数字和下划线":
    "Role codes must start with ROLE_ and contain only uppercase letters, numbers, and underscores",
  请输入权限名称: "Enter a permission name",
  "权限编码使用小写分段格式，例如 asset:list":
    "Use lowercase, colon-separated permission codes, such as asset:list",
  管理更改已保存: "Management changes saved",
  搜索用户名称或邮箱: "Search usernames or emails",
  搜索名称或编码: "Search names or codes",
  搜索管理记录: "Search management records",
  全部状态: "All statuses",
  按账户状态筛选: "Filter by account status",
  全部角色: "All roles",
  按角色筛选: "Filter by role",
  "共 {count} 条记录": "{count} records",
  暂无匹配记录: "No matching records",
  角色已停用: "Role disabled",
  最后登录: "Last sign-in",
  内置: "Built-in",
  状态: "Status",
  关联用户: "Assigned users",
  关联角色: "Assigned roles",
  直接授权用户: "Directly assigned users",
  权限数量: "Permissions",
  操作: "Actions",
  "确认删除？": "Confirm deletion?",
  删除: "Delete",
  "删除用户「{name}」？账户会被停用并撤销登录，媒体文件不会删除，邮箱仍保留。":
    "Delete user “{name}”? The account and its sessions will be disabled. Media files and the reserved email address will be retained.",
  "删除角色「{name}」？此操作不可撤销。":
    "Delete role “{name}”? This cannot be undone.",
  "删除权限「{name}」？对应用户和角色的授权会一并移除，相关账户需要重新登录。":
    "Delete permission “{name}”? Its user and role grants will be removed, and affected accounts must sign in again.",
  "删除用户仅停用账户并保留媒体，不会释放已占用的邮箱。":
    "Deleting users disables their accounts and preserves their media. Their email addresses remain reserved.",
  "有关联用户的角色不能删除，请先为用户更换角色。":
    "Roles assigned to users cannot be deleted. Assign those users to another role first.",
  "有子权限的记录不能删除，请先调整子权限的父级。":
    "Permissions with children cannot be deleted. Reparent their children first.",
  "所选权限不存在，请刷新后重试":
    "A selected permission no longer exists. Refresh and try again.",
  角色不存在: "Role not found",
  "仅管理员可以管理用户、角色和权限":
    "Only administrators can manage users, roles, and permissions",
  "名称、邮箱或编码已存在": "The name, email, or code already exists",
  "记录仍被引用，请先解除关联":
    "The record is still referenced. Remove its associations first.",
  记录不存在或已被删除: "The record does not exist or has been deleted",
  "数据已变化，请刷新后重试": "The data has changed. Refresh and try again.",
  请选择启用的角色: "Select an enabled role",
  邮箱已注册: "This email address is already registered",
  请至少修改一个字段: "Change at least one field",
  用户不存在: "User not found",
  不能停用自己或移除自己的管理员角色:
    "You cannot disable yourself or remove your own administrator role",
  必须保留至少一名启用的管理员:
    "At least one enabled administrator must remain",
  不能删除当前登录的管理员: "You cannot delete the signed-in administrator",
  "默认用户角色不存在，请先初始化系统":
    "The default user role is missing. Initialize the system first.",
  内置角色编码不可用于新角色:
    "Built-in role codes cannot be used for new roles",
  不能修改内置角色编码: "Built-in role codes cannot be changed",
  不能停用管理员角色: "The administrator role cannot be disabled",
  不能删除内置角色: "Built-in roles cannot be deleted",
  "角色仍关联用户，请先为这些用户更换角色":
    "The role is still assigned to users. Assign those users to another role first.",
  权限层级不能形成循环: "The permission hierarchy cannot contain cycles",
  父级权限不存在: "The parent permission does not exist",
  内置权限编码不可用于新权限:
    "Built-in permission codes cannot be used for new permissions",
  权限不存在: "Permission not found",
  不能修改内置权限编码: "Built-in permission codes cannot be changed",
  不能删除内置权限: "Built-in permissions cannot be deleted",
  请先删除或移动子权限: "Delete or move the child permissions first",
  编辑人物: "Edit person",
  编辑标签: "Edit tag",
  存储: "Storage",
  媒体: "Media",
  本地文件存储: "Local file storage",
  "原图片、视频与派生文件保存于本地文件系统。":
    "Original images, videos, and derived files are stored on the local filesystem.",
  "当前存储提供器为 LOCAL_FS。存储根目录由服务器部署配置决定，网页不能修改磁盘路径；界面统计仅包含当前账户记录的原文件大小。":
    "The storage provider is LOCAL_FS. The deployment determines its root directory; disk paths cannot be edited here. Statistics include only original files recorded for the current account.",
  "Sharp 图像缩略图与 exifr 拍摄信息提取。":
    "Image thumbnails with Sharp and capture metadata extraction with exifr.",
  "支持 JPEG（含 JFIF/PJPEG/PJP）、PNG/APNG、WebP、GIF、AVIF 与安全静态 SVG；动图原文件保留动画，缩略图取首帧。仅提取存在的 EXIF、拍摄时间和 GPS，不生成虚构信息。":
    "Supports JPEG (including JFIF/PJPEG/PJP), PNG/APNG, WebP, GIF, AVIF, and safe static SVG. Original animations are preserved; thumbnails use the first frame. Only existing EXIF, capture dates, and GPS are extracted.",
  异步任务队列: "Background task queue",
  "RabbitMQ 媒体入库队列与失败重试。":
    "RabbitMQ media ingestion queue with retries.",
  "任务状态保存在数据库，支持失败任务手动重试、退避重试和待处理记录补投。已内置表示代码能力，不代表消息代理当前连接正常；不支持网页暂停整个队列。":
    "Task state is stored in the database, with manual retries, backoff, and recovery of pending records. Built-in indicates code support, not broker health. The entire queue cannot be paused here.",
  关键词搜索: "Keyword search",
  "按文件名、手动标签、AI 画面描述和识别文字筛选媒体。":
    "Filter media by filenames, manual tags, AI descriptions, and recognized text.",
  "keyword 模式匹配文件名、手动标签及已完成的 AI 描述、关键词和 OCR，多个关键词为 AND 关系；保留现有筛选与游标分页，不计算向量相似度。":
    "Keyword mode matches filenames, manual tags, and completed AI descriptions, keywords, and OCR. All keywords must match. Filters and cursor pagination are retained; vector similarity is not calculated.",
  "GPS 地点归类": "GPS grouping",
  "根据照片已有的经纬度聚合位置。":
    "Group locations using coordinates already present in photos.",
  "按 0.1° 网格聚合当前账户未删除图片。只绘制坐标分布示意，不请求外部地图瓦片或地理编码服务，也不猜测城市名称。":
    "Groups this account's undeleted images on a 0.1° grid. Only coordinate distribution is drawn; no external map tiles, geocoding, or inferred city names are used.",
  "AI 图像描述": "AI image descriptions",
  "根据图像内容自动生成描述和主题标签。":
    "Generate descriptions and topic keywords from image content.",
  "通过 LangChain 接入 OpenAI 兼容视觉模型。需要配置模型、密钥及服务地址；新图片可自动识别，已有图片在搜索页手动补建。模型输出独立保存，不改动人工标签。识图请求可能产生第三方费用。":
    "Uses OpenAI-compatible vision models through LangChain. Configure a model, key, and service URL. New images can be indexed automatically; index existing images from Search. Results are stored separately without changing manual tags. Provider fees may apply.",
  语义向量检索: "Semantic vector search",
  "自然语言检索与图像 Embedding 匹配。":
    "Natural-language retrieval and image embedding matching.",
  "尚未配置 Embedding 模型或向量数据库；当前先用视觉模型识图，再从描述、关键词和识别文字中检索，不伪造向量相似度。":
    "No embedding model or vector database is connected to search. A vision model recognizes images, then descriptions, keywords, and text are searched. No invented similarity scores are shown.",
  人脸识别: "Face recognition",
  "检测人脸并自动聚类同一人物。":
    "Detect faces and automatically group the same person.",
  "自动人脸识别尚未接入。人物页使用「人物:姓名」手动标签持久化归类，支持关联媒体、命名和合并；预览不是人脸裁剪。":
    "Automatic face recognition is not connected. The People page uses persistent person-name tags with manual association, naming, and merging. Previews are not face crops.",
  "OCR 文字识别": "OCR text recognition",
  "识别截图与照片中的文字。": "Recognize text in screenshots and photos.",
  "视觉模型转录图片中清晰可见的文字，结果持久化并参与关键词检索；可在媒体详情查看。准确度受图片清晰度和所配置模型影响，不保证逐字准确。":
    "The vision model transcribes visible text for persistent keyword search and media details. Accuracy depends on image clarity and the configured model; exact transcription is not guaranteed.",
  "S3 / 对象存储": "S3 / object storage",
  "扩展远端存储提供器。": "Add remote storage providers.",
  "当前仅实现 LOCAL_FS，不支持在网页中切换 S3、MinIO 或其他对象存储。":
    "Only LOCAL_FS is implemented. Switching to S3, MinIO, or other object storage is not supported here.",
  视频处理: "Video processing",
  "视频抽帧、转码与在线预览。":
    "Video frame extraction, transcoding, and online previews.",
  "超过 5 MiB 自动分片，支持 24 小时断点续传和同账户 BLAKE3 秒传复用。视频不超过 512 MiB、4 小时；后台生成封面、H.264/AAC 兼容预览及约 4 秒一段的 HLS 视频流，浏览器通过 m3u8 按需播放。原文件不改动，下载支持 HTTP Range。服务器需部署包含 libx264、AAC、libwebp 的 FFmpeg/ffprobe；首次转码完成前可读取原视频，不保证任意网络环境下固定一秒起播。":
    "Files over 5 MiB use chunked uploads with 24-hour resume and same-account BLAKE3 deduplication. Videos are limited to 512 MiB and 4 hours. Background processing creates covers, H.264/AAC previews, and HLS segments of about 4 seconds for on-demand m3u8 playback. Originals are unchanged and support HTTP Range downloads. The server needs FFmpeg/ffprobe with libx264, AAC, and libwebp. Originals are available before transcoding completes; startup latency depends on the network.",
  "统一身份认证与企业登录。": "Centralized identity and enterprise sign-in.",
  "当前提供邮箱密码登录、邮箱激活及找回密码。OIDC、SSO 与 LDAP 尚未接入。":
    "Email/password sign-in, email activation, and password recovery are available. OIDC, SSO, and LDAP are not connected.",
  任务通知: "Task notifications",
  "任务完成通知与 Webhook 扩展。":
    "Task completion notifications and webhooks.",
  "任务通知与 Webhook 尚未接入。现有 SMTP 仅用于账户激活与找回密码，由服务器配置，不能据此认定任务通知已启用。":
    "Task notifications and webhooks are not connected. Server-configured SMTP is used only for account activation and password recovery; it does not imply task notifications are enabled.",
  "定时备份原图、数据库与媒体关联。":
    "Scheduled backups of originals, the database, and media associations.",
  "没有自动备份调度接口。生产数据需通过部署环境备份数据库与存储目录；浏览器偏好开关不能替代真正的备份。":
    "No automatic backup scheduler API is available. Back up the production database and storage directories through your deployment environment; browser preferences are not a substitute for backups.",
  本地媒体库: "Local media library",
  "正在准备你的媒体库…": "Preparing your media library…",
  界面语言: "Language",
  "语言已切换，但浏览器无法保存此偏好。":
    "Language changed, but your browser could not save this preference.",
  取消: "Cancel",
  确认: "Confirm",
  请确认: "Please confirm",
  媒体播放地址无效: "Invalid media playback URL",
  "操作失败，请稍后重试": "Operation failed. Please try again later.",
  "安全校验失败，请重新提交；若仍失败，请检查 Cookie 设置或联系管理员":
    "Security check failed. Submit again; if it persists, check cookies or contact your administrator.",
  "操作过于频繁，请稍后再试": "Too many requests. Please try again later.",
  "服务器暂时不可用，请稍后重试":
    "The server is temporarily unavailable. Please try again later.",
  "登录状态已失效，请重新登录":
    "Your session has expired. Please sign in again.",
  "请求失败，请稍后重试": "Request failed. Please try again later.",
  "服务器未返回安全令牌，请联系管理员":
    "The server did not return a security token. Contact your administrator.",
  请求已取消: "Request canceled",
  "登录状态已变化，请重试": "Your session has changed. Please try again.",
  "服务器返回了非 JSON 响应，请检查 API 地址与代理配置":
    "The server returned a non-JSON response. Check the API URL and proxy configuration.",
  媒体预览正在生成: "The media preview is being generated",
  服务器未返回可用的媒体文件: "The server did not return a usable media file",
  "请求超时，请稍后重试": "Request timed out. Please try again later.",
  "无法连接服务器，请检查网络及后端服务":
    "Cannot connect to the server. Check your network and backend service.",
  "移入回收站？": "Move to trash?",
  "将选中的 {value1} 项媒体移入回收站，可在回收站中恢复。":
    "Move {value1} selected items to trash? You can restore them later.",
  移入回收站: "Move to trash",
  "已将 {value1} 项媒体移入回收站": "Moved {value1} items to trash",
  "已恢复 {value1} 项媒体": "Restored {value1} items",
  "永久删除媒体？": "Permanently delete media?",
  "将永久删除选中的 {value1} 项媒体及其相册、标签关联。此操作不可恢复，请确认已有必要备份。":
    "Permanently delete {value1} selected items and their album and tag associations? This cannot be undone. Make sure you have a backup.",
  永久删除: "Delete permanently",
  "已删除 {value1} 项记录；{value2} 个存储对象清理失败，请管理员查看服务器日志。":
    "Deleted {value1} records; cleanup failed for {value2} storage objects. Ask your administrator to check the server logs.",
  "已永久删除 {value1} 项媒体": "Permanently deleted {value1} items",
  "已交给浏览器流式下载，可在浏览器下载列表查看进度。":
    "Download started in your browser. Check its download list for progress.",
  "验证码加载失败，请点击重试": "Could not load the captcha. Click to retry.",
  请输入邮箱地址: "Enter your email address",
  "邮箱地址不能超过 254 位": "Email addresses cannot exceed 254 characters",
  请输入有效的邮箱地址: "Enter a valid email address",
  "请输入 4 位图形验证码": "Enter the 4-character captcha",
  "密码至少需要 8 位": "Use at least 8 characters for your password",
  "密码不能超过 72 字节，请缩短密码后重试":
    "Passwords cannot exceed 72 bytes. Please use a shorter password.",
  "请输入至少 6 位的密码": "Enter a password with at least 6 characters",
  请输入昵称: "Enter a display name",
  请再次输入密码: "Enter your password again",
  请先同意服务条款与隐私政策:
    "Accept the terms of service and privacy policy first",
  两次输入的密码不一致: "The passwords do not match",
  "请输入邮件中的完整 64 位重置验证码":
    "Enter the complete 64-character reset code from your email",
  请再次输入新密码: "Enter your new password again",
  "JPEG（含 JFIF / PJPEG / PJP）、PNG / APNG、WebP、GIF、AVIF、SVG":
    "JPEG (including JFIF / PJPEG / PJP), PNG / APNG, WebP, GIF, AVIF, SVG",
  "图片 ≤ 10 MiB；视频 ≤ 512 MiB、4 小时":
    "Images ≤ 10 MiB; videos ≤ 512 MiB and 4 hours",
  资源库: "Library",
  图库: "Gallery",
  相册: "Albums",
  收藏: "Favorites",
  标签: "Tags",
  "AI 智能搜索": "AI Search",
  人物: "People",
  地点: "Places",
  系统: "System",
  任务中心: "Tasks",
  插件与扩展: "Plugins & Extensions",
  回收站: "Trash",
  设置: "Settings",
  等待处理: "Pending",
  正在处理: "Processing",
  已完成: "Completed",
  处理失败: "Failed",
  登录: "Sign in",
  注册: "Sign up",
  忘记密码: "Forgot password",
  激活账户: "Activate account",
  相册详情: "Album details",
  标签详情: "Tag details",
  人物详情: "Person details",
  服务器返回的登录信息不完整:
    "The server returned incomplete sign-in information",
  "无法读取账户信息，请联系管理员":
    "Cannot load your account. Contact your administrator.",
  "登录状态已变化，请重新登录":
    "Your session has changed. Please sign in again.",
  "账户不可用，请重新登录": "Account unavailable. Please sign in again.",
  "服务器未完成注销，请稍后重试":
    "The server could not complete sign-out. Try again later.",
  "浏览器无法读取偏好，当前使用默认设置。":
    "Your browser could not load preferences. Using defaults.",
  "浏览器禁止本地存储，设置仅在本次页面中生效。":
    "Local storage is blocked. Preferences apply to this page session only.",
  "上传队列最多保留 100 项，请先清理已完成项目。":
    "The upload queue holds at most 100 items. Clear completed items first.",
  "请选择受支持的图片或 MP4 / MOV / MKV 视频":
    "Select a supported image or MP4 / MOV / MKV video",
  "视频需大于 0 B 且不超过 512 MiB":
    "Videos must be larger than 0 B and no larger than 512 MiB",
  "图片需大于 0 B 且不超过 10 MiB":
    "Images must be larger than 0 B and no larger than 10 MiB",
  文件名过长或含有不支持的字符:
    "The filename is too long or contains unsupported characters",
  "服务器已完成此会话，但对应文件已不可用，请重新选择文件。":
    "This upload session is complete, but its file is no longer available. Select the file again.",
  请重新选择文件: "Please select the file again",
  "服务器仍在校验合并，可稍后继续；已上传的分片不会重复发送。":
    "The server is still verifying the merged file. Resume later; uploaded chunks will not be sent again.",
  已取消收藏: "Removed from favorites",
  已加入收藏: "Added to favorites",
  文件指纹计算失败: "File hashing failed",
  上传已暂停: "Upload paused",
  "文件指纹计算失败，请重试": "File hashing failed. Please try again.",
  服务端返回的分片配置无效: "The server returned invalid chunk settings",
  "分片指纹缺失，请重新选择文件":
    "Chunk hashes are missing. Select the file again.",
  "Media Hub 产品介绍": "About Media Hub",
  "你的媒体，": "Your media,",
  "只属于你自己。": "yours alone.",
  "本地部署、AI 驱动、完全离线。用自然语言找到任何一张照片，所有推理都在你自己的设备上完成——数据永不出门。":
    "Self-hosted, AI-powered, fully offline. Find photos with natural language. All inference runs on your own device, keeping your data at home.",
  "100% 离线": "100% offline",
  "本地 AI 推理": "Local AI inference",
  插件化扩展: "Plugin extensions",
  服务条款: "Terms of service",
  隐私政策: "Privacy policy",
  "本实例用于管理你拥有或已获授权的媒体资源。请勿上传违法内容，或侵犯他人的版权与隐私。":
    "Use this instance to manage media you own or are authorized to use. Do not upload illegal content or infringe on copyright or privacy.",
  "请妥善保管账户密码，不向他人分享验证码或登录令牌；在公共设备上使用完毕后退出登录。":
    "Keep your password secure. Never share verification codes or sign-in tokens. Sign out when using a shared device.",
  "实例的可用性、存储配额、数据备份及具体使用规则由部署管理员负责。如有疑问，请联系当前实例管理员。":
    "Your instance administrator manages availability, storage limits, backups, and usage policies. Contact them with any questions.",
  "注册时提交的昵称、邮箱和密码将发送给当前实例的后端。后端以哈希形式保存密码，并使用配置的邮件服务发送账户邮件。":
    "Your display name, email, and password are sent to this instance when you register. The backend stores a password hash and sends account emails through its configured mail service.",
  "登录后，浏览器会保存登录令牌及基本账户信息。勾选“保持登录状态”使用本地存储，否则仅保留在当前浏览器会话中。":
    "After sign-in, the browser stores your token and basic account information. Stay signed in uses local storage; otherwise, information lasts only for this browser session.",
  "验证码图片来自当前实例；展示区沿用原型中的 Picsum 示例图片，会向该图片服务发出请求，但不附带页面来源信息。":
    "Captchas come from this instance. The showcase uses Picsum sample images and requests them without sending a referrer.",
  "媒体数据的存储、访问权限及删除策略以当前部署配置为准。请联系实例管理员了解适用的数据管理政策。":
    "Media storage, access permissions, and deletion policies depend on this deployment. Contact your administrator for its data management policy.",
  我已了解: "Got it",
  账户入口: "Account access",
  图形验证码: "Captcha",
  输入验证码: "Enter captcha",
  换一张: "Get a new image",
  正在加载验证码: "Loading captcha",
  刷新图形验证码: "Refresh captcha",
  "图形验证码，点击换一张": "Captcha image; click to refresh",
  点击重试: "Click to retry",
  密码强度: "Password strength",
  尚未输入密码: "No password entered",
  "密码强度：{value1}": "Password strength: {value1}",
  "使用字母、数字与符号增强强度":
    "Use letters, numbers, and symbols for a stronger password",
  太弱: "Weak",
  一般: "Fair",
  较强: "Strong",
  非常强: "Very strong",
  账户邮箱: "Account email",
  "正在提交邮件请求…": "Requesting email…",
  "{value1} 秒后可重新发送": "Resend in {value1} seconds",
  发送重置邮件: "Send reset email",
  "如果邮箱对应的账户可用，将收到一次性重置链接和验证码。未收到邮件时，请检查垃圾邮件或联系实例管理员。":
    "If this email has an eligible account, you will receive a one-time reset link and code. Check your spam folder or contact your administrator if no email arrives.",
  "我已有验证码，直接重置": "I already have a reset code",
  "请在 {value1} 秒后重新发送": "Please wait {value1} seconds before resending",
  请先加载图形验证码: "Load a captcha first",
  "邮件请求响应不完整，请稍后重试":
    "Incomplete email response. Please try again later.",
  "AI 图片索引状态": "AI image indexing status",
  图片内容索引: "Image content index",
  刷新识图进度: "Refresh recognition progress",
  "补建索引 / 重试失败": "Index existing images / retry failures",
  "已识图 {value1} / {value2}": "Recognized {value1} / {value2}",
  "等待 {value1}": "Pending {value1}",
  "识别中 {value1}": "Recognizing {value1}",
  "失败 {value1}": "Failed {value1}",
  "未建索引 {value1}": "Not indexed {value1}",
  "新图片在媒体处理完成后自动识别。":
    "New images are recognized automatically after media processing.",
  "新图片自动识图未启用。": "Automatic recognition of new images is disabled.",
  "当前模型：{value1}。": "Current model: {value1}.",
  "{value1} 已有图片需手动补建，每批最多 {value2} 张；描述、AI 关键词和识别文字可直接搜索。 {value3}":
    "{value1} Index existing images manually, up to {value2} per batch. Descriptions, AI keywords, and recognized text are searchable. {value3}",
  "补建 AI 图片索引？": "Build the AI image index?",
  "将最多 {value1} 张图片的压缩图发送到已配置的 AI 服务，可能产生调用费用。只处理未识别或识别失败的图片，不修改人工标签。":
    "Send compressed copies of up to {value1} images to the configured AI service. Usage fees may apply. Only unrecognized or failed images are processed; manual tags are not changed.",
  开始识图: "Start recognition",
  "已将 {value1} 张图片加入识图队列。":
    "Added {value1} images to the recognition queue.",
  编辑相册: "Edit album",
  新建相册: "New album",
  "给回忆一个名字，让每一张照片都有归属。":
    "Give your memories a name and your photos a home.",
  相册名称: "Album name",
  "例如：夏日旅行": "For example: Summer vacation",
  "描述（可选）": "Description (optional)",
  "记录一些与这段回忆有关的事…": "Write something about these memories…",
  保存更改: "Save changes",
  创建相册: "Create album",
  请输入相册名称: "Enter an album name",
  相册已更新: "Album updated",
  "相册已创建，可以添加照片了": "Album created. You can now add photos.",
  添加到相册: "Add to album",
  "已选择 {value1} 项媒体，不会移动或复制原文件。":
    "{value1} items selected. Original files will not be moved or copied.",
  选择相册: "Select album",
  请选择相册: "Choose an album",
  "还没有相册，请先新建": "No albums yet. Create one first.",
  项: " items",
  新相册名称: "New album name",
  "例如：旅行的记忆": "For example: Travel memories",
  选择已有相册: "Choose an existing album",
  请先选择相册或输入新相册名称: "Select an album or enter a new album name",
  "已添加 {value1} 项媒体到相册": "Added {value1} items to the album",
  所选媒体已在此相册中: "The selected items are already in this album",
  媒体筛选: "Media filters",
  "最近 7 天上传": "Uploaded in the last 7 days",
  "原文件大于等于 5 MB": "Original file size at least 5 MB",
  尚未加入相册: "Not in any album",
  "筛选已上传的 MP4 / MOV / MKV 视频": "Filter uploaded MP4 / MOV / MKV videos",
  时间范围筛选: "Date range filter",
  退出多选: "Exit selection",
  批量选择: "Select items",
  刷新媒体列表: "Refresh media",
  时间字段: "Date field",
  上传时间: "Upload date",
  "拍摄时间（EXIF）": "Date taken (EXIF)",
  "开始日期（UTC）": "Start date (UTC)",
  "结束日期（含当日）": "End date (inclusive)",
  应用范围: "Apply range",
  重置筛选: "Reset filters",
  "已选择 {value1} 项": "{value1} selected",
  "选择已加载项（最多 100）": "Select loaded items (up to 100)",
  恢复: "Restore",
  "标签 / 人物": "Tags / People",
  解除分组关联: "Remove from group",
  从相册移除: "Remove from album",
  设为封面: "Set as cover",
  已加载: "Loaded ",
  "项结果 · 关键词匹配 · 本次查询 {value1} ms · 按上传时间倒序":
    " results · keyword matching · query: {value1} ms · newest uploads first",
  正在加载媒体: "Loading media",
  没有符合筛选条件的媒体: "No media matches these filters",
  "你的图库，等待第一张照片": "Your gallery is waiting for its first photo",
  "尝试更换筛选条件，或检查图片是否包含拍摄时间。":
    "Try different filters or check whether the photos include a capture date.",
  "上传照片，将重要的回忆与创作整理在同一个地方。":
    "Upload photos to keep your memories and creations in one place.",
  清除筛选条件: "Clear filters",
  上传第一张照片: "Upload your first photo",
  重试加载更多: "Retry loading more",
  "正在加载…": "Loading…",
  加载更多: "Load more",
  " · 已加载全部": " · All loaded",
  "已显示 {value1} 项{value2} · 最新上传优先":
    "Showing {value1} items{value2} · Newest uploads first",
  全部: "All",
  图片: "Images",
  视频: "Videos",
  最近上传: "Recent uploads",
  未分类: "Uncategorized",
  大文件: "Large files",
  开始日期不能晚于结束日期: "The start date cannot be after the end date",
  请选择有效日期: "Select a valid date",
  "一次最多选择 100 项媒体，请分批操作。":
    "Select up to 100 items at a time. Please work in batches.",
  "从相册移除？": "Remove from album?",
  "移除 {value1} 项相册关联。媒体仍保留在图库，不会删除原文件。":
    "Remove {value1} album associations? The media stays in your gallery and original files are not deleted.",
  移除: "Remove",
  "已从相册移除，原图仍保留在图库":
    "Removed from album. Originals remain in your gallery.",
  已更新相册封面: "Album cover updated",
  "解除分组关联？": "Remove from group?",
  "将 {value1} 项媒体从当前标签或人物分组中移除，原图和其他标签保留。":
    "Remove {value1} items from this tag or person group? Original files and other tags are preserved.",
  解除关联: "Remove association",
  "已解除 {value1} 项媒体的分组关联": "Removed {value1} group associations",
  "已解除 {value1} 项；{value2}": "Removed {value1} items; {value2}",
  媒体详情: "Media details",
  重新加载预览: "Reload preview",
  查看原视频: "View original video",
  查看原图片: "View original image",
  下载原视频: "Download original video",
  下载原图片: "Download original image",
  取消收藏: "Remove from favorites",
  短链分享: "Share via short link",
  分享相册: "Share album",
  图片分享: "Shared images",
  目前仅支持分享图片: "Only images can be shared at this time",
  "持有链接的人可查看原图并登录保存，请勿分享私密内容。原图可能包含位置信息。":
    "Anyone with the link can view originals and sign in to save them. Do not share private content. Originals may contain location information.",
  "相册仅分享其中的图片，最多 500 张。撤销或过期后无法继续访问，但不会删除对方已经保存的内容。":
    "Only album images are shared, up to 500. Revocation or expiry prevents further access but does not delete copies already saved by others.",
  链接有效期: "Link expiry",
  永久有效: "Never expires",
  生成分享链接: "Create share link",
  分享链接: "Share link",
  复制链接: "Copy link",
  分享链接已复制: "Share link copied",
  "自动复制失败，请选中链接手动复制":
    "Automatic copy failed. Select and copy the link manually",
  分享已撤销: "Share revoked",
  最近的分享链接: "Recent share links",
  尚未创建分享链接: "No share links yet",
  已撤销: "Revoked",
  已过期: "Expired",
  有效: "Active",
  "有效期至 {value1}": "Expires {value1}",
  "撤销后此链接将无法访问，确定继续？":
    "Revoking this link prevents further access. Continue?",
  撤销分享: "Revoke share",
  我的图库: "My library",
  "{value1} 张图片": "{value1} images",
  已保存: "Saved",
  保存到我的图库: "Save to my library",
  登录后保存: "Sign in to save",
  "保存会建立属于你的独立副本，不修改原作者内容。同一链接只保存一次；相册后续新增的图片不会自动同步。":
    "Saving creates your own copies without changing the originals. Each link is saved once; later album additions do not sync automatically.",
  "此分享已保存过，可在图库或回收站查找。":
    "This share was already saved. Check your library or trash.",
  "已保存 {value1} 张图片": "Saved {value1} images",
  查看已保存的相册: "View saved album",
  查看我的图库: "View my library",
  暂无可分享的图片: "No shared images available",
  "图片可能已被分享者移除。": "The owner may have removed these images.",
  "查看原图：{value1}": "View original: {value1}",
  "浏览器无法显示此原图，仍可保存到你的图库。":
    "Your browser cannot display this original, but you can still save it to your library.",
  分享已失效或内容不可用: "The share has expired or its content is unavailable",
  没有可分享的图片: "There are no images available to share",
  "一次最多分享 500 张图片，请拆分相册":
    "Share up to 500 images at a time. Split the album first",
  "一次最多保存 500 张图片，请联系分享者拆分相册":
    "Save up to 500 images at a time. Ask the owner to split the album",
  分享不存在: "Share not found",
  恢复到图库: "Restore to gallery",
  "已于 {value1} 移入回收站": "Moved to trash on {value1}",
  视频封面与兼容预览: "Video cover and compatible preview",
  "缩略图与 EXIF": "Thumbnails and EXIF",
  "AI 内容分析": "AI content analysis",
  "回收站图片不会发送给 AI 服务，恢复后可查看或生成识图结果。":
    "Images in trash are not sent to the AI service. Restore an image to view or generate its recognition results.",
  "当前 AI 识图用于图片；视频仍通过文件名和手动标签检索。":
    "AI recognition currently supports images. Videos are searchable by filename and manual tags.",
  标签与人物: "Tags and people",
  添加: "Add",
  "移除标签 {value1}": "Remove tag {value1}",
  "暂无标签，添加后可更快找到此媒体。":
    "No tags yet. Add tags to find this media more easily.",
  所属相册: "Albums",
  视频信息: "Video information",
  "文件信息 · EXIF": "File information · EXIF",
  "内容校验 · {value1}": "Content hash · {value1}",
  文件大小: "File size",
  媒体尺寸: "Dimensions",
  视频时长: "Video duration",
  拍摄时间: "Date taken",
  相机品牌: "Camera make",
  相机型号: "Camera model",
  镜头: "Lens",
  "焦距 (mm)": "Focal length (mm)",
  "曝光时间 (s)": "Exposure time (s)",
  光圈: "Aperture",
  文件格式: "File format",
  已移除此标签关联: "Tag association removed",
  "查看 {value1}": "View {value1}",
  取消选择: "Deselect",
  选择: "Select",
  文件名称: "Filename",
  重命名: "Rename",
  重命名文件: "Rename file",
  "仅修改名称，保留原扩展名，不影响原文件、相册和分享链接。":
    "Change the filename only. The extension, original file, albums, and share links stay unchanged.",
  "文件名称（不含扩展名）": "Filename (without extension)",
  请输入文件名称: "Enter a filename",
  请输入有效的文件名称: "Enter a valid filename",
  文件名称不能包含路径分隔符或控制字符:
    "Filenames cannot contain path separators or control characters",
  "文件名称（含扩展名）不能超过 255 个字符":
    "Filenames, including the extension, cannot exceed 255 characters",
  文件名称已更新: "Filename updated",
  处理状态: "Processing status",
  上传日期: "Upload date",
  大小: "Size",
  "选择 {value1}": "Select {value1}",
  "视频 · {value1} ·": "Video · {value1} ·",
  预览不可用: "Preview unavailable",
  缩略图生成中: "Generating thumbnail",
  媒体预览: "Media preview",
  "一次最多选择 100 项；只添加关联，不复制原文件。":
    "Select up to 100 items. Only associations are added; original files are not copied.",
  搜索文件名或标签: "Search filenames or tags",
  筛选可选媒体: "Filter available media",
  搜索: "Search",
  没有找到媒体: "No media found",
  "先在图库上传图片，或换一个关键词。":
    "Upload images to your gallery first, or try a different keyword.",
  添加所选媒体: "Add selected media",
  选择图库媒体: "Choose media from gallery",
  刷新图片识别结果: "Refresh recognition results",
  查看识别文字: "View recognized text",
  "模型：{value1}。AI 结果可能存在误识别，仅作检索参考；动画只识别首帧。":
    "Model: {value1}. AI results may be inaccurate and are for search reference only. Only the first frame of an animation is recognized.",
  "正在识别图片内容…": "Recognizing image content…",
  "已进入识图队列，等待后台处理…": "Queued for background recognition…",
  "图片识别失败，可检查配置后重试。":
    "Image recognition failed. Check your configuration and retry.",
  "尚未生成内容索引，识图完成后可通过画面描述、关键词和文字搜索。":
    "No content index yet. After recognition, search by visual descriptions, keywords, and text.",
  重试识图: "Retry recognition",
  识别图片: "Recognize image",
  "识别图片内容？": "Recognize image content?",
  "将压缩图片发送到已配置的 AI 服务，生成画面描述、关键词和文字索引，可能产生调用费用。":
    "Send a compressed image to the configured AI service to generate a description, keywords, and text index. Usage fees may apply.",
  "兼容预览 · MP4（非原文件）": "Compatible preview · MP4 (not the original)",
  原视频: "Original video",
  原图片: "Original image",
  关闭原文件预览: "Close original media preview",
  "关闭（Esc）": "Close (Esc)",
  重新加载: "Reload",
  原文件预览操作: "Original media preview controls",
  缩小: "Zoom out",
  "缩小（-）": "Zoom out (-)",
  缩放比例: "Zoom level",
  放大: "Zoom in",
  "放大（+）": "Zoom in (+)",
  "适应窗口（0）": "Fit to window (0)",
  适应窗口: "Fit to window",
  "原始尺寸（1）": "Actual size (1)",
  "原始尺寸 100%": "Actual size 100%",
  "切换 HLS 流播": "Switch to HLS streaming",
  "准备下载…": "Preparing download…",
  "HLS 按需加载约 4 秒的视频分段，无需完整下载；原文件下载支持 HTTP Range。":
    "HLS loads video segments of about 4 seconds on demand, without downloading the entire file. Original downloads support HTTP Range.",
  "滚轮缩放 · 拖动平移 · 动图保留原始动画":
    "Scroll to zoom · Drag to pan · Animations play in their original format",
  "{value1} · Esc 关闭": "{value1} · Esc to close",
  "后台正在生成 HLS 视频流，可切回原视频或稍后再试…":
    "The server is generating the HLS stream. Switch to the original video or try again later…",
  "HLS 视频流仍在处理中，请稍后重试；原视频仍可查看和下载。":
    "HLS is still processing. Try again later; the original video is available to view and download.",
  "正在连接原视频流…": "Connecting to the original video stream…",
  "正在读取原图片…": "Loading original image…",
  "正在加载 HLS 播放列表与首段视频…":
    "Loading the HLS playlist and first segment…",
  "此浏览器不支持 HLS 播放，请查看原视频或更换浏览器。":
    "This browser does not support HLS. View the original video or use another browser.",
  "视频流加载失败或播放凭证失效，请重新加载；也可查看或下载原视频。":
    "The stream failed to load or its playback credentials expired. Reload, or view or download the original video.",
  "当前浏览器无法播放此原视频的容器或编码。请切换 HLS 流播，或下载原视频用本地播放器打开。":
    "This browser cannot play the original video's container or codec. Switch to HLS or download the original and use a local player.",
  "浏览器无法播放 HLS 视频流。请重试或下载原视频用本地播放器打开。":
    "This browser cannot play the HLS stream. Retry or download the original and use a local player.",
  "当前浏览器无法显示此原图片。请下载原文件，使用支持该格式的浏览器或图片查看器打开。":
    "This browser cannot display the original image. Download it and open it in a compatible browser or image viewer.",
  "添加标签 / 人物": "Add tags / people",
  "将标签保存到选中的 {value1} 项媒体。人物以专用标签手动归类，不进行人脸识别。":
    "Save tags to {value1} selected items. People are organized manually with dedicated tags, not face recognition.",
  添加为人物姓名: "Add as a person name",
  人物姓名: "Person name",
  标签名称: "Tag name",
  多个名称用逗号或换行分隔: "Separate names with commas or new lines",
  保存标签: "Save tags",
  "请填写 1～50 个标签，每个标签（含人物前缀）不超过 100 字符。":
    "Enter 1–50 tags. Each tag, including the person prefix, must be no longer than 100 characters.",
  "已为 {value1} 项媒体添加{value2}": "Added {value2} to {value1} items",
  "已成功更新 {value1} 项；{value2}。可重试，已有标签不会重复添加。":
    "Updated {value1} items; {value2}. You can retry without duplicating existing tags.",
  编辑: "Edit",
  新建: "New",
  为人物命名: "Name this person",
  "例如：旅行、风景、灵感": "For example: Travel, Landscape, Inspiration",
  "人物使用「{value1}姓名」标签持久化保存，你可以手动添加与合并照片分组。":
    "People are stored using the tag “{value1}Name”. You can manually add and merge photo groups.",
  保存: "Save",
  请输入名称: "Enter a name",
  更新: "updated",
  创建: "created",
  "{value1}已{value2}": "{value1} {value2}",
  "{value1} 位人物 · 按人整理，让重要的人更容易找到":
    "{value1} people · Keep the important people easy to find",
  "{value1} 个标签 · 为灵感建立自己的索引":
    "{value1} tags · Build your own index of inspiration",
  完成管理: "Done managing",
  管理分组: "Manage groups",
  添加人物: "Add person",
  新建标签: "New tag",
  "当前提供手动人物归类，可命名、关联媒体与合并同一人物。头像使用分组中的照片预览，不进行人脸裁剪；自动人脸识别模型尚未接入。":
    "People are grouped manually. Name people, associate media, and merge duplicates. Avatars use photo previews without face cropping. Automatic face recognition is not connected.",
  查找人物: "Find people",
  查找标签: "Find tags",
  "查找人物…": "Find people…",
  "查找标签…": "Find tags…",
  没有找到匹配分组: "No matching groups",
  为照片里的重要人物命名: "Name the important people in your photos",
  还没有标签: "No tags yet",
  "添加人物后，可从图库选择照片，或在详情中添加人物标签。":
    "After adding a person, select photos from your gallery or add a person tag in media details.",
  "创建主题标签，或在媒体详情中直接添加。":
    "Create topic tags or add them directly in media details.",
  添加第一位人物: "Add your first person",
  " 项媒体": " media items",
  "重命名 {value1}": "Rename {value1}",
  "合并 {value1}": "Merge {value1}",
  "删除 {value1}": "Delete {value1}",
  "删除{value1}？": "Delete {value1}?",
  "删除「{value1}」与全部关联，不会删除媒体文件。":
    "Delete “{value1}” and all its associations? Media files will not be deleted.",
  删除分组: "Delete group",
  "分组已删除，原文件已保留": "Group deleted. Original files are preserved.",
  合并分组: "Merge groups",
  "将「{value1}」合并到其他同类分组。":
    "Merge “{value1}” into another group of the same type.",
  合并到: "Merge into",
  请选择目标分组: "Choose a target group",
  没有其他可合并的同类分组: "No other groups of the same type to merge into",
  合并: "Merge",
  "确认合并？": "Confirm merge?",
  "「{value1}」的所有关联将转移到「{value2}」，原分组会被删除，重复关联会自动去重。":
    "All associations of “{value1}” will move to “{value2}”. The original group is deleted and duplicate associations are removed.",
  "分组已合并，媒体文件保持不变": "Groups merged. Media files are unchanged.",
  显示方式: "View mode",
  瀑布流视图: "Masonry view",
  列表视图: "List view",
  暂时无法加载: "Unable to load right now",
  这里还没有媒体: "No media here yet",
  正在从你的媒体库获取数据: "Fetching data from your library",
  上传队列: "Upload queue",
  上传文件: "Upload files",
  上传到相册: "Upload to album",
  目标相册: "Target album",
  正在加入相册: "Adding to album",
  "可直接上传到此相册，或点击「添加媒体」从图库选择。":
    "Upload directly to this album, or select existing items with Add media.",
  "文件已上传，加入相册未完成：{value1}。重试不会重新上传文件。":
    "The file is uploaded, but adding it to the album is incomplete: {value1}. Retrying will not upload the file again.",
  "已停止加入相册，文件仍保留在图库。":
    "Stopped adding to the album. The file remains in your library.",
  展开上传队列: "Expand upload queue",
  折叠上传队列: "Collapse upload queue",
  "隐藏上传队列，上传继续": "Hide the queue and keep uploading",
  "选择图片或视频，开始建立你的媒体库。":
    "Choose images or videos to start your library.",
  "计算指纹 {value1}%": "Hashing {value1}%",
  合并校验中: "Verifying merged file",
  "续传 ": "Resuming ",
  秒传完成: "Instant upload complete",
  "继续上传 {value1}": "Resume upload: {value1}",
  "重试加入相册 {value1}": "Retry adding to album: {value1}",
  "暂停上传 {value1}": "Pause upload: {value1}",
  暂停: "Pause",
  "取消上传 {value1}": "Cancel upload: {value1}",
  "停止加入相册 {value1}": "Stop adding to album: {value1}",
  "{value1}，不限制图片和视频像素，动图 ≤ 1000 帧。":
    "{value1}; no image or video pixel limit, up to 1,000 animation frames.",
  "动图保留动画，SVG 仅接受安全静态图形。超过 5 MiB 自动分片，支持暂停与断点续传。":
    "Animations are preserved. SVG accepts only safe, static graphics. Files over 5 MiB use resumable chunked uploads.",
  "刷新后 24 小时内重选同一文件可续传；已有文件按内容指纹秒传复用。 视频后台生成封面及 HLS 按段播放流。":
    "Reselect the same file within 24 hours of a refresh to resume. Existing files are reused by content hash. Video covers and segmented HLS streams are generated in the background.",
  清理已完成: "Clear completed",
  查看处理任务: "View processing tasks",
  继续上传: "Resume upload",
  等待上传: "Waiting to upload",
  上传中: "Uploading",
  已暂停: "Paused",
  已上传: "Uploaded",
  上传未完成: "Upload incomplete",
  已取消: "Canceled",
  跳到主内容: "Skip to main content",
  媒体库导航: "Library navigation",
  打开导航: "Open navigation",
  折叠侧边栏: "Collapse sidebar",
  展开侧边栏: "Expand sidebar",
  "搜索你的媒体，用关键词找到灵感…":
    "Search your media and find inspiration with keywords…",
  查看后台任务: "View background tasks",
  显示上传队列: "Show upload queue",
  "账户与设置：{value1}": "Account and settings: {value1}",
  我: "Me",
  选择上传图片或视频: "Choose images or videos to upload",
  "松开鼠标，上传到图库": "Drop to upload to your gallery",
  "松开鼠标，上传到当前相册": "Drop to upload to the current album",
  "离开媒体库？": "Leave the library?",
  "仍有上传未完成。离开会停止本机上传请求，服务器可能已经接收部分文件；返回后请先查看图库。":
    "Uploads are still in progress. Leaving stops local upload requests, but the server may already have received some files. Check your gallery when you return.",
  离开: "Leave",
  "Media Hub 图库": "Media Hub gallery",
  关闭导航: "Close navigation",
  原图存储: "Original file storage",
  "当前账户 · 图库与回收站": "Current account · Gallery and trash",
  "不含缩略图，不代表磁盘总容量":
    "Excludes thumbnails; not total disk capacity",
  "统计获取失败，点击重试": "Could not load statistics. Click to retry.",
  正在激活账户: "Activating account",
  账户已激活: "Account activated",
  暂时无法激活: "Unable to activate right now",
  "正在核验邮件中的激活链接，请稍候…":
    "Verifying the activation link from your email. Please wait…",
  "你的账户已准备就绪，现在可以登录了。":
    "Your account is ready. You can sign in now.",
  "请确认链接完整且未过期，或联系实例管理员。":
    "Check that the link is complete and has not expired, or contact your administrator.",
  重试激活: "Retry activation",
  返回登录: "Back to sign in",
  "激活链接缺少 token，请打开邮件中的完整链接。":
    "The activation link is missing its token. Open the complete link from your email.",
  "账户激活未完成，请稍后重试":
    "Account activation was not completed. Please try again later.",
  "{value1} 项媒体{value2}": "{value1} media items{value2}",
  全部相册: "All albums",
  删除相册: "Delete album",
  添加媒体: "Add media",
  "添加到 {value1}": "Add to {value1}",
  "已添加 {value1} 项媒体": "Added {value1} media items",
  "删除相册？": "Delete album?",
  "删除「{value1}」及其关联，图库原文件将保留。":
    "Delete “{value1}” and its associations? Original files stay in your gallery.",
  相册已删除: "Album deleted",
  "{value1} 个相册 · ": "{value1} albums · ",
  "{value1}把零散的瞬间，整理成完整的故事":
    "{value1}Turn scattered moments into complete stories",
  刷新相册: "Refresh albums",
  "让每一段回忆，都有自己的相册": "Give every memory its own album",
  "支持手动归档与自定义封面，AI 智能相册推荐尚未接入。":
    "Organize albums manually and choose custom covers. AI album recommendations are not connected yet.",
  创建一个相册: "Create an album",
  查找相册: "Find albums",
  "查找相册…": "Find albums…",
  相册排序: "Sort albums",
  最近创建: "Recently created",
  名称排序: "Name",
  媒体数量: "Media count",
  没有找到相册: "No albums found",
  从一个新相册开始: "Start with a new album",
  "按旅行、家人或创作主题整理你的照片。":
    "Organize photos by trips, family, or creative projects.",
  "{value1} 项媒体": "{value1} media items",
  "编辑相册 {value1}": "Edit album {value1}",
  "删除相册 {value1}": "Delete album {value1}",
  "删除「{value1}」及相册关联，图库中的原文件不会被删除。":
    "Delete “{value1}” and its album associations? Original files in your gallery will not be deleted.",
  "相册已删除，原图仍保留在图库":
    "Album deleted. Original images remain in your gallery.",
  "{value1} 项收藏 · ": "{value1} favorites · ",
  "{value1}为喜欢的瞬间留一个专属位置":
    "{value1}A special place for your favorite moments",
  密码已重置: "Password reset",
  "新的密码，新的开始。": "A new password, a fresh start.",
  设置新密码: "Set a new password",
  "验证你的邮箱，找回属于你的媒体库":
    "Verify your email to recover your media library",
  "使用邮件中的验证码，为账户设置新密码":
    "Use the code from your email to set a new password",
  找回密码步骤: "Password recovery steps",
  验证邮箱: "Verify email",
  设置密码: "Set password",
  邮件重置验证码: "Email reset code",
  粘贴邮件中的完整验证码: "Paste the complete code from your email",
  "粘贴邮件中的完整 64 位验证码，{value1} 分钟内有效，仅最新一份可用。":
    "Paste the complete 64-character code. It expires in {value1} minutes; only the latest code is valid.",
  重新获取邮件: "Request another email",
  新密码: "New password",
  "至少 8 位": "At least 8 characters",
  确认新密码: "Confirm new password",
  再次输入新密码: "Enter your new password again",
  "正在重置密码…": "Resetting password…",
  重置密码: "Reset password",
  "想起密码了？": "Remember your password? ",
  去登录: "Sign in",
  "密码重置未完成，请稍后重试":
    "Password reset was not completed. Please try again later.",
  最新上传优先: "Newest uploads first",
  "{value1} 项媒体 · ": "{value1} media items · ",
  "{value1}你的回忆与灵感，都在这里":
    "{value1}Your memories and inspiration, all here",
  欢迎回来: "Welcome back",
  登录到你的本地媒体库: "Sign in to your local media library",
  "正在恢复登录…": "Restoring your session…",
  重试恢复已有登录: "Retry restoring your session",
  邮箱: "Email",
  密码: "Password",
  "忘记密码？": "Forgot password?",
  保持登录状态: "Stay signed in",
  "正在登录…": "Signing in…",
  进入媒体库: "Open media library",
  或使用: "Or continue with",
  "当前服务器尚未启用 OIDC / SSO 登录":
    "OIDC / SSO sign-in is not enabled on this server",
  "当前服务器尚未启用 LDAP 登录": "LDAP sign-in is not enabled on this server",
  第三方登录尚未启用: "Third-party sign-in is not enabled",
  "还没有账户？": "No account yet? ",
  立即注册: "Sign up now",
  "账户已创建，请先通过邮件激活账户，再登录。":
    "Account created. Activate it through your email before signing in.",
  "账户激活成功，现在可以登录了。":
    "Your account is activated. You can sign in now.",
  "密码重置成功，请使用新密码登录。":
    "Password reset successfully. Sign in with your new password.",
  "登录状态已失效，请重新登录。":
    "Your session has expired. Please sign in again.",
  "你已退出登录。": "You have signed out.",
  "所有设备上的登录会话已退出，请重新登录。":
    "You have signed out on all devices. Please sign in again.",
  "已清除本机登录状态，但服务器注销未完成，请稍后确认会话状态。":
    "Your local session was cleared, but server sign-out did not complete. Check your session status later.",
  "{value1} 项带 GPS 的媒体 · {value2} 个坐标分组":
    "{value1} items with GPS · {value2} coordinate groups",
  "用照片里的坐标，重新看见走过的地方":
    "Rediscover the places you have been through photo coordinates",
  刷新地点: "Refresh places",
  "还没有包含 GPS 的照片": "No photos with GPS yet",
  "上传保留拍摄位置 EXIF 的原图，完成元数据提取后即可在这里查看。":
    "Upload original photos that retain location EXIF. Places appear after metadata extraction.",
  "GPS 分布示意": "GPS distribution",
  "纬度 ↑ · 经度 →": "Latitude ↑ · Longitude →",
  "{value1}，{value2} 项媒体": "{value1}, {value2} media items",
  "按 0.1° 网格聚合 · 按坐标范围自适应，不是道路地图 · 概览显示数量最多的 {value1} 个分组":
    "Grouped on a 0.1° grid · Scaled to coordinate bounds, not a road map · Showing the {value1} largest groups",
  "列表展示数量最多的 {value1} 个分组。":
    "The list shows the {value1} largest groups.",
  "仅使用照片中已有的经纬度，不向外部地图服务发送位置，不推断城市名称。{value1}":
    "Only existing photo coordinates are used. Locations are not sent to external map services and city names are not inferred. {value1}",
  "{value1} 附近的媒体": "Media near {value1}",
  清除地点: "Clear location",
  "按需拓展媒体库，每项能力的边界都清晰可见":
    "Extend your library with a clear view of every capability",
  刷新能力: "Refresh capabilities",
  "能力清单由后端返回。「已内置」表示代码已集成，不是运行健康检查。当前没有插件热安装或启停接口，不能在网页中假装打开未部署的服务。":
    "Capabilities are reported by the backend. Built-in means integrated in code, not a health check. No live plugin installation or enable/disable API is available; the page cannot activate undeployed services.",
  "已内置，不支持网页关闭": "Built-in; cannot be disabled here",
  "尚未接入，不可启用": "Not connected; cannot be enabled",
  "内置能力随服务器部署，不支持网页关闭":
    "Built-in capabilities are managed by server deployment, not this page",
  后端尚未接入此能力: "This capability is not connected on the backend",
  已内置: "Built-in",
  尚未接入: "Not connected",
  查看详情: "View details",
  扩展详情: "Extension details",
  内置能力: "Built-in capability",
  全部能力: "All capabilities",
  查收激活邮件: "Check your activation email",
  "离你的本地媒体库，只差最后一步。":
    "One final step to your local media library.",
  激活邮件已发送至: "An activation email was sent to ",
  "。请在 30 分钟内打开邮件中的激活链接，激活后再登录。":
    ". Open its activation link within 30 minutes, then sign in.",
  "未收到邮件？请检查垃圾邮件，或联系实例管理员确认邮件服务配置。":
    "No email? Check your spam folder or ask your administrator to verify the mail configuration.",
  创建账户: "Create account",
  在本地服务器上建立你的账户: "Create your account on the local server",
  昵称: "Display name",
  你的名字: "Your name",
  确认密码: "Confirm password",
  再次输入密码: "Enter your password again",
  我已阅读并同意: "I have read and agree to ",
  与: " and ",
  "正在创建账户…": "Creating account…",
  "已经有账户？": "Already have an account? ",
  "账户创建成功，请前往邮箱激活账户。":
    "Account created. Check your email to activate it.",
  "检索画面描述、图片文字、文件名和标签":
    "Search visual descriptions, image text, filenames, and tags",
  搜索帮助: "Search help",
  找到你记忆中的画面: "Find the scene you remember",
  "AI 识图索引 + 关键词检索": "AI recognition index + keyword search",
  "画面内容、图片文字、文件名或标签关键词":
    "Keywords for image content, image text, filenames, or tags",
  "例如：海边 日落，多个关键词以空格分隔":
    "For example: beach sunset; separate keywords with spaces",
  "搜索匹配文件名、手动标签，以及已完成识图的画面描述、AI 关键词和识别文字。 空格分隔的关键词需全部匹配；未识图的旧图片可在下方补建索引，不展示虚构相似度。":
    "Search matches filenames, manual tags, and completed AI descriptions, keywords, and recognized text. All space-separated keywords must match. Index older images below; no invented similarity scores are shown.",
  查询: "Query",
  图片内容与元数据检索: "Image content and metadata search",
  暂无搜索权限: "Search permission required",
  "当前账户没有媒体搜索权限，请联系管理员。":
    "Your account cannot search media. Contact your administrator.",
  "记得一点线索，就从这里开始": "Start with any detail you remember",
  "输入关键词，或点击示例查询；搜索结果均来自你的真实媒体库。":
    "Enter keywords or choose an example. All results come from your actual media library.",
  "了解 AI 扩展能力": "Explore AI extensions",
  搜索使用说明: "How search works",
  "当前接口使用 keyword 模式，搜索你自己的未删除媒体，匹配文件名、手动标签和已完成的 AI 识图结果；例如「海边 日落」表示两个关键词都匹配，可以分别出现在描述或标签中。":
    "Keyword mode searches your own undeleted media, matching filenames, manual tags, and completed AI results. For example, “beach sunset” requires both keywords, which may appear in different descriptions or tags.",
  "最多支持 200 个字符、16 个不同关键词。可以叠加上传 / 拍摄时间、图片类型、未分类或大文件筛选，结果按上传时间倒序。":
    "Use up to 200 characters and 16 distinct keywords. Combine upload or capture dates, media type, uncategorized, or large-file filters. Results show newest uploads first.",
  "AI 识图会生成图片描述、关键词和清晰可辨的文字，可能存在误识别。新图片可自动识别，旧图片需手动补建；这会向已配置的服务发送压缩图片并可能产生费用。 当前不提供向量相似度检索，也不会自动识别人脸身份或理解整个视频。":
    "AI recognition generates descriptions, keywords, and legible text, but may make mistakes. New images can be indexed automatically; older images require manual indexing. Compressed images are sent to the configured service and fees may apply. Vector similarity search, face identification, and whole-video understanding are not provided.",
  "海边 日落": "beach sunset",
  猫: "cat",
  "产品 蓝色": "blue product",
  雪山: "snowy mountains",
  截图: "screenshot",
  旅行: "travel",
  让媒体库更适合你的使用习惯: "Make the library work the way you do",
  恢复显示默认值: "Reset display preferences",
  外观与显示: "Appearance and display",
  "浏览器偏好 · 自动保存": "Browser preferences · Saved automatically",
  界面主题: "Theme",
  默认展示方式: "Default view",
  瀑布流: "Masonry",
  列表: "List",
  始终显示文件名称: "Always show filenames",
  "在图片卡片底部显示名称与标签，无需鼠标悬停。":
    "Show names and tags at the bottom of image cards without hovering.",
  紧凑瀑布流: "Compact masonry",
  "大屏显示更多列，适合快速浏览大量图片。":
    "Show more columns on large screens to browse many images quickly.",
  界面动画: "Interface animations",
  "启用卡片与抽屉过渡；同时尊重系统的减弱动态效果设置。":
    "Enable card and drawer transitions while respecting system reduced-motion preferences.",
  浏览与更新: "Browsing and updates",
  自动刷新任务与统计: "Automatically refresh tasks and statistics",
  "任务首页每 10 秒、侧栏统计每 30 秒更新，后台标签页暂停轮询。关闭不影响服务器处理。":
    "Refresh the task overview every 10 seconds and sidebar statistics every 30 seconds. Polling pauses in background tabs. Turning this off does not stop server processing.",
  "这些偏好保存在当前浏览器，按账户隔离；主题为浏览器共享。不上传到服务器，也不会改变处理队列配置。":
    "Display preferences stay in this browser and are separated by account; the theme is shared. Nothing is uploaded to the server or changes the processing queue configuration.",
  存储与上传: "Storage and uploads",
  "服务器能力 · 只读": "Server capabilities · Read only",
  存储提供器: "Storage provider",
  图库原文件: "Gallery originals",
  回收站原文件: "Trash originals",
  单张图片上传上限: "Maximum image upload size",
  单个视频上传上限: "Maximum video upload size",
  视频时长上限: "Maximum video duration",
  "{value1} 小时": "{value1} hours",
  动图帧数上限: "Maximum animation frames",
  "{value1} 帧": "{value1} frames",
  单帧像素上限: "Maximum pixels per frame",
  不限制: "Unlimited",
  "{value1} 万像素": "{value1} × 10,000 pixels",
  回收站自动清理: "Automatic trash cleanup",
  未启用: "Disabled",
  "{value1} 天": "{value1} days",
  "不包含缩略图、兼容视频预览及其他用户数据。存储路径与服务器容量需由部署环境管理。":
    "Excludes thumbnails, compatible video previews, and other users' data. Storage paths and server capacity are managed by the deployment environment.",
  媒体处理与扩展: "Media processing and extensions",
  查看能力清单: "View capabilities",
  重试: "Retry",
  "上传后生成缩略图、EXIF 或视频预览":
    "Generate thumbnails, EXIF, or video previews after upload",
  "后端内置流程，不支持在网页关闭。":
    "Built into the backend; cannot be disabled on this page.",
  "正在获取服务器能力，不代表已启用。":
    "Fetching server capabilities; this does not mean they are enabled.",
  "AI 自动描述与标签": "Automatic AI descriptions and tags",
  "未接入图像描述模型，当前使用手动标签。":
    "No image-captioning model is connected; manual tags are used.",
  自动人脸识别: "Automatic face recognition",
  "自动识别尚未接入，可在人物页手动归类。":
    "Automatic recognition is not connected. Organize people manually on the People page.",
  自动备份: "Automatic backups",
  "没有备份调度接口，请在部署环境备份数据。":
    "No backup scheduler API is available. Back up data in your deployment environment.",
  账户与安全: "Account and security",
  编辑个人资料: "Edit profile",
  个人资料已更新: "Profile updated",
  头像: "Avatar",
  选择头像: "Choose avatar",
  移除头像: "Remove avatar",
  "昵称需为 1–80 个字符": "Display name must be 1–80 characters",
  "支持 PNG、JPEG、WebP，最大 5 MiB；自动居中裁剪并压缩，保存后生效。":
    "PNG, JPEG, or WebP up to 5 MiB. Automatically center-cropped and compressed; applied when you save.",
  "邮箱用于登录，如需修改请联系管理员；角色和权限不能在此修改。":
    "Your email is used to sign in. Contact an administrator to change it; roles and permissions cannot be edited here.",
  "请选择 PNG、JPEG 或 WebP 图片": "Choose a PNG, JPEG, or WebP image",
  "头像文件需大于 0 且不超过 5 MiB":
    "Avatar file must be non-empty and no larger than 5 MiB",
  "头像图片不能超过 2000 万像素": "Avatar image must not exceed 20 megapixels",
  当前浏览器无法处理头像: "Your browser cannot process this avatar",
  "头像数据过大，请重新选择图片":
    "Avatar data is too large. Choose another image",
  "无法读取图片，请重新选择头像":
    "Cannot read the image. Choose another avatar",
  "头像内容无效，请选择 PNG、JPEG 或 WebP 图片":
    "Invalid avatar content. Choose a PNG, JPEG, or WebP image",
  "账户状态已变化，请重新登录":
    "Your account status has changed. Sign in again",
  服务器返回的账户信息不完整:
    "The server returned incomplete account information",
  角色: "Role",
  退出当前设备: "Sign out this device",
  退出所有设备: "Sign out all devices",
  "查看账户权限（{value1}）": "View account permissions ({value1})",
  "昵称和头像可在此修改并保存到服务器。邮箱、角色和权限保持只读；重置密码后旧会话失效，退出所有设备会撤销服务端会话。":
    "Edit your display name and avatar here and save them to the server. Email, roles, and permissions are read-only. Password resets invalidate old sessions; signing out all devices revokes server-side sessions.",
  深色: "Dark",
  浅色: "Light",
  跟随系统: "System",
  "主题已切换，但浏览器无法保存，刷新后可能恢复默认。":
    "Theme changed, but your browser could not save it. Refreshing may restore the default.",
  "恢复默认显示设置？": "Reset display preferences?",
  "只重置本账户在此浏览器中的显示偏好和主题，不会删除照片或修改服务器配置。":
    "Reset only this account's display preferences and this browser's theme. Photos and server configuration are not changed.",
  恢复默认: "Restore defaults",
  已恢复默认显示设置: "Default display preferences restored",
  "将撤销当前账户在所有设备上的登录会话。":
    "This revokes your account's sessions on every device.",
  "将退出当前设备。": "This signs out the current device.",
  "仍有上传未完成，退出会停止本机请求；服务器可能已经接收部分文件。":
    "Uploads are still running. Signing out stops local requests; the server may already have received some files.",
  "退出所有设备？": "Sign out all devices?",
  "确认退出？": "Confirm sign-out?",
  退出登录: "Sign out",
  手动人物归类: "Manual people grouping",
  手动标签: "Manual tags",
  "{value1} 项媒体 · {value2}": "{value1} media items · {value2}",
  全部人物: "All people",
  全部标签: "All tags",
  重命名分组: "Rename group",
  关联媒体: "Associate media",
  为这个人物添加照片: "Add photos of this person",
  这个标签下还没有媒体: "No media has this tag yet",
  "关联到 {value1}": "Associate with {value1}",
  "分组不存在或已被合并，请返回分组列表。":
    "This group does not exist or has been merged. Return to the group list.",
  "已关联 {value1} 项媒体": "Associated {value1} media items",
  "已成功关联 {value1} 项；{value2}。可重试，已有记录不会重复添加。":
    "Associated {value1} items; {value2}. You can retry without duplicating existing records.",
  "删除分组？": "Delete group?",
  "删除「{value1}」及关联，媒体文件仍保留。":
    "Delete “{value1}” and its associations? Media files are preserved.",
  分组已删除: "Group deleted",
  后台任务中心: "Background tasks",
  "图片入库处理 · 缩略图生成 · EXIF 元数据提取":
    "Image ingestion · Thumbnail generation · EXIF extraction",
  当前后端不支持暂停或取消运行中的任务:
    "The backend does not support pausing or canceling running tasks",
  暂停全部: "Pause all",
  刷新: "Refresh",
  全部入库任务: "All ingestion tasks",
  "每 10 秒刷新首页": "Refresh overview every 10 seconds",
  手动刷新列表: "Refresh list manually",
  "{value1} · 仅当前账户的未删除图片":
    "{value1} · Only this account's undeleted images",
  这里暂时没有任务: "No tasks here yet",
  "上传图片后将自动创建入库任务，完成后可查看缩略图与拍摄信息。":
    "Uploading images creates ingestion tasks automatically. Thumbnails and capture information appear when processing completes.",
  缩略图生成与元数据提取: "Thumbnail generation and metadata extraction",
  "上传于 {value1} · 已尝试 {value2} 次":
    "Uploaded {value1} · {value2} attempts",
  "· 下次尝试 {value1}": "· Next attempt {value1}",
  加载更多任务: "Load more tasks",
  "状态与重试次数来自真实入库记录，处理中不展示虚构的百分比。暂不支持队列暂停、任务取消或自动清理已完成记录。":
    "Status and retry counts come from real ingestion records. No invented progress percentages are shown. Queue pausing, task cancellation, and automatic cleanup of completed records are not supported.",
  运行中: "Running",
  等待中: "Waiting",
  失败: "Failed",
  任务已重新投递到处理队列: "Task requeued for processing",
  "已重置为待处理；队列恢复连接后将自动补投":
    "Reset to pending; it will be requeued automatically when the queue reconnects",
  "{value1}误删的照片，仍可在这里找回":
    "{value1}Recover photos deleted by mistake",
  "正在处理 · 已删除 {value1}": "Processing · {value1} deleted",
  清空回收站: "Empty trash",
  "恢复会保留收藏、相册与标签关联。永久删除无法撤销；当前未启用自动过期清理，回收站仍占用存储空间。":
    "Restoring preserves favorites, album memberships, and tags. Permanent deletion cannot be undone. Automatic expiration is disabled, so trashed media still uses storage.",
  回收站已经是空的: "Trash is already empty",
  "清空回收站？": "Empty trash?",
  "将永久删除当前回收站中的 {value1} 项媒体。此操作不可恢复，确认后分批删除；操作期间新移入的媒体不会被删除。":
    "Permanently delete the {value1} items currently in trash? This cannot be undone. Deletion runs in batches; newly trashed items are not included.",
  "永久删除 {value1} 项": "Permanently delete {value1} items",
  "已删除 {value1} 项记录，{value2} 个存储对象需管理员查看日志后清理。":
    "Deleted {value1} records; {value2} storage objects need administrator cleanup after reviewing logs.",
  "另有 {value1} 个存储对象需管理员清理。":
    "Another {value1} storage objects require administrator cleanup.",
  "已删除 {value1} 项；{value2}。请刷新后检查剩余媒体。{value3}":
    "Deleted {value1} items; {value2}. Refresh to check remaining media. {value3}",
};
