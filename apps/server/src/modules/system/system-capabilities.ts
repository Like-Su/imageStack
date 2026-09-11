import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_PIXELS,
  IMAGE_MAX_FRAMES,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_MS,
  MEDIA_MIME_TYPES,
  MEDIA_EXTENSIONS,
} from '../../common/media-formats';
import {
  UPLOAD_CHUNK_BYTES,
  UPLOAD_MULTIPART_TTL_MS,
} from '../uploads/upload.constants';
import { HLS_SEGMENT_SECONDS } from '../../common/video-stream';

export const systemCapabilities = {
  storageProvider: 'LOCAL_FS',
  searchMode: 'keyword',
  peopleMode: 'manual-tags',
  trashRetentionDays: null,
  pluginManagement: false,
  upload: {
    maxBytes: VIDEO_MAX_BYTES,
    imageMaxBytes: IMAGE_MAX_BYTES,
    videoMaxBytes: VIDEO_MAX_BYTES,
    videoMaxDurationMs: VIDEO_MAX_DURATION_MS,
    maxPixels: IMAGE_MAX_PIXELS,
    maxFrames: IMAGE_MAX_FRAMES,
    extensions: MEDIA_EXTENSIONS,
    mimeTypes: MEDIA_MIME_TYPES,
    chunkThresholdBytes: UPLOAD_CHUNK_BYTES,
    chunkSizeBytes: UPLOAD_CHUNK_BYTES,
    resumableTtlMs: UPLOAD_MULTIPART_TTL_MS,
    instantUpload: 'same-owner-blake3',
    hlsSegmentSeconds: HLS_SEGMENT_SECONDS,
  },
  extensions: [
    {
      id: 'local-storage',
      name: '本地文件存储',
      category: '存储',
      builtin: true,
      description: '原图片、视频与派生文件保存于本地文件系统。',
      detail:
        '当前存储提供器为 LOCAL_FS。存储根目录由服务器部署配置决定，网页不能修改磁盘路径；界面统计仅包含当前账户记录的原文件大小。',
    },
    {
      id: 'thumbnails',
      name: '缩略图与 EXIF',
      category: '媒体',
      builtin: true,
      description: 'Sharp 图像缩略图与 exifr 拍摄信息提取。',
      detail:
        '支持 JPEG（含 JFIF/PJPEG/PJP）、PNG/APNG、WebP、GIF、AVIF 与安全静态 SVG；动图原文件保留动画，缩略图取首帧。仅提取存在的 EXIF、拍摄时间和 GPS，不生成虚构信息。',
    },
    {
      id: 'queue',
      name: '异步任务队列',
      category: '系统',
      builtin: true,
      description: 'RabbitMQ 媒体入库队列与失败重试。',
      detail:
        '任务状态保存在数据库，支持失败任务手动重试、退避重试和待处理记录补投。已内置表示代码能力，不代表消息代理当前连接正常；不支持网页暂停整个队列。',
    },
    {
      id: 'keyword-search',
      name: '关键词搜索',
      category: '搜索',
      builtin: true,
      description: '按文件名、手动标签、AI 画面描述和识别文字筛选媒体。',
      detail:
        'keyword 模式匹配文件名、手动标签及已完成的 AI 描述、关键词和 OCR，多个关键词为 AND 关系；保留现有筛选与游标分页，不计算向量相似度。',
    },
    {
      id: 'gps',
      name: 'GPS 地点归类',
      category: '媒体',
      builtin: true,
      description: '根据照片已有的经纬度聚合位置。',
      detail:
        '按 0.1° 网格聚合当前账户未删除图片。只绘制坐标分布示意，不请求外部地图瓦片或地理编码服务，也不猜测城市名称。',
    },
    {
      id: 'caption',
      name: 'AI 图像描述',
      category: 'AI',
      builtin: true,
      description: '根据图像内容自动生成描述和主题标签。',
      detail:
        '通过 LangChain 接入 OpenAI 兼容视觉模型。需要配置模型、密钥及服务地址；新图片可自动识别，已有图片在搜索页手动补建。模型输出独立保存，不改动人工标签。识图请求可能产生第三方费用。',
    },
    {
      id: 'vector-search',
      name: '语义向量检索',
      category: 'AI',
      builtin: false,
      description: '自然语言检索与图像 Embedding 匹配。',
      detail:
        '尚未配置 Embedding 模型或向量数据库；当前先用视觉模型识图，再从描述、关键词和识别文字中检索，不伪造向量相似度。',
    },
    {
      id: 'face',
      name: '人脸识别',
      category: 'AI',
      builtin: false,
      description: '检测人脸并自动聚类同一人物。',
      detail:
        '自动人脸识别尚未接入。人物页使用「人物:姓名」手动标签持久化归类，支持关联媒体、命名和合并；预览不是人脸裁剪。',
    },
    {
      id: 'ocr',
      name: 'OCR 文字识别',
      category: 'AI',
      builtin: true,
      description: '识别截图与照片中的文字。',
      detail:
        '视觉模型转录图片中清晰可见的文字，结果持久化并参与关键词检索；可在媒体详情查看。准确度受图片清晰度和所配置模型影响，不保证逐字准确。',
    },
    {
      id: 's3',
      name: 'S3 / 对象存储',
      category: '存储',
      builtin: false,
      description: '扩展远端存储提供器。',
      detail:
        '当前仅实现 LOCAL_FS，不支持在网页中切换 S3、MinIO 或其他对象存储。',
    },
    {
      id: 'video',
      name: '视频处理',
      category: '媒体',
      builtin: true,
      description: '视频抽帧、转码与在线预览。',
      detail:
        '超过 5 MiB 自动分片，支持 24 小时断点续传和同账户 BLAKE3 秒传复用。视频不超过 512 MiB、4 小时；后台生成封面、H.264/AAC 兼容预览及约 4 秒一段的 HLS 视频流，浏览器通过 m3u8 按需播放。原文件不改动，下载支持 HTTP Range。服务器需部署包含 libx264、AAC、libwebp 的 FFmpeg/ffprobe；首次转码完成前可读取原视频，不保证任意网络环境下固定一秒起播。',
    },
    {
      id: 'sso',
      name: 'OIDC / SSO',
      category: '系统',
      builtin: false,
      description: '统一身份认证与企业登录。',
      detail:
        '当前提供邮箱密码登录、邮箱激活及找回密码。OIDC、SSO 与 LDAP 尚未接入。',
    },
    {
      id: 'notifications',
      name: '任务通知',
      category: '系统',
      builtin: false,
      description: '任务完成通知与 Webhook 扩展。',
      detail:
        '任务通知与 Webhook 尚未接入。现有 SMTP 仅用于账户激活与找回密码，由服务器配置，不能据此认定任务通知已启用。',
    },
    {
      id: 'backup',
      name: '自动备份',
      category: '存储',
      builtin: false,
      description: '定时备份原图、数据库与媒体关联。',
      detail:
        '没有自动备份调度接口。生产数据需通过部署环境备份数据库与存储目录；浏览器偏好开关不能替代真正的备份。',
    },
  ],
};
