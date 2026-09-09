import {
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_PIXELS,
} from '../uploads/upload.constants';

export const systemCapabilities = {
  storageProvider: 'LOCAL_FS',
  searchMode: 'keyword',
  peopleMode: 'manual-tags',
  trashRetentionDays: null,
  pluginManagement: false,
  upload: {
    maxBytes: UPLOAD_MAX_BYTES,
    maxPixels: UPLOAD_MAX_PIXELS,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  extensions: [
    {
      id: 'local-storage',
      name: '本地文件存储',
      category: '存储',
      builtin: true,
      description: '原图与派生文件保存于本地文件系统。',
      detail:
        '当前存储提供器为 LOCAL_FS。存储根目录由服务器部署配置决定，网页不能修改磁盘路径；界面统计仅包含当前账户记录的原图大小。',
    },
    {
      id: 'thumbnails',
      name: '缩略图与 EXIF',
      category: '媒体',
      builtin: true,
      description: 'Sharp 图像缩略图与 exifr 拍摄信息提取。',
      detail:
        '上传图片后异步生成 WebP 缩略图并提取 EXIF、拍摄时间和 GPS；支持 JPEG、PNG、WebP。缺少 EXIF 的图片不会生成虚构的拍摄信息。',
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
      description: '按文件名、手动标签和条件筛选媒体。',
      detail:
        'keyword 模式按文件名与标签匹配，多个关键词为 AND 关系；支持时间、收藏、相册、标签、大小和 GPS 分组过滤。不计算向量相似度。',
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
      builtin: false,
      description: '根据图像内容自动生成描述和主题标签。',
      detail:
        '尚未接入图像描述模型和推理服务，当前使用手动标签。此卡片不是可安装的在线插件。',
    },
    {
      id: 'vector-search',
      name: '语义向量检索',
      category: 'AI',
      builtin: false,
      description: '自然语言检索与图像 Embedding 匹配。',
      detail:
        '尚未接入向量模型或向量数据库。AI 智能搜索页当前回退到真实关键词接口，不伪造检索分数。',
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
      builtin: false,
      description: '识别截图与照片中的文字。',
      detail:
        '尚未接入 OCR 引擎，也没有文字识别结果存储和查询接口。请使用文件名或手动标签搜索。',
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
      builtin: false,
      description: '视频抽帧、转码与在线预览。',
      detail:
        '视频处理与 FFmpeg 尚未接入，当前上传端只接受 JPEG、PNG 和 WebP 图片。',
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
