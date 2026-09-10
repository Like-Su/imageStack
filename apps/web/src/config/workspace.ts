import {
  Images,
  FolderOpen,
  Star,
  Tags,
  Sparkles,
  Users,
  MapPin,
  ListTodo,
  Puzzle,
  Trash2,
  Settings,
} from "lucide-vue-next";

export const PERSON_TAG_PREFIX = "人物:";
export const UPLOAD_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_VIDEO_MAX_BYTES = 512 * 1024 * 1024;
export const UPLOAD_CHUNK_BYTES = 5 * 1024 * 1024;
export const UPLOAD_CHUNK_CONCURRENCY = 3;
const imageExtensions = [
  "jpg",
  "jpeg",
  "jfif",
  "pjpeg",
  "pjp",
  "png",
  "apng",
  "webp",
  "gif",
  "avif",
  "svg",
];
const videoExtensions = ["mp4", "mov", "mkv"];
export const UPLOAD_ACCEPT = [
  ...imageExtensions.map((extension) => `.${extension}`),
  ...videoExtensions.map((extension) => `.${extension}`),
  "image/jpeg",
  "image/png",
  "image/apng",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
].join(",");
export const UPLOAD_IMAGE_LABEL =
  "JPEG（含 JFIF / PJPEG / PJP）、PNG / APNG、WebP、GIF、AVIF、SVG";
export const UPLOAD_VIDEO_LABEL = "MP4 / MOV / MKV";
export const UPLOAD_LIMITS_LABEL = "图片 ≤ 10 MiB；视频 ≤ 512 MiB、4 小时";

export function uploadMediaKind(fileName: string): "image" | "video" | null {
  const extension = /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase() ?? "";
  if (imageExtensions.includes(extension)) return "image";
  if (videoExtensions.includes(extension)) return "video";
  return null;
}

export const navigation = [
  {
    label: "资源库",
    items: [
      { name: "home", label: "图库", icon: Images, count: "total" },
      { name: "albums", label: "相册", icon: FolderOpen, count: "albums" },
      { name: "favorites", label: "收藏", icon: Star, count: "favorites" },
      { name: "tags", label: "标签", icon: Tags, count: "tags" },
    ],
  },
  {
    label: "AI",
    items: [
      { name: "search", label: "AI 智能搜索", icon: Sparkles },
      { name: "people", label: "人物", icon: Users },
      { name: "places", label: "地点", icon: MapPin },
    ],
  },
  {
    label: "系统",
    items: [
      { name: "tasks", label: "任务中心", icon: ListTodo },
      { name: "plugins", label: "插件与扩展", icon: Puzzle },
      { name: "trash", label: "回收站", icon: Trash2, count: "trash" },
      { name: "settings", label: "设置", icon: Settings },
    ],
  },
] as const;

export const processingLabels = {
  PENDING: "等待处理",
  PROCESSING: "正在处理",
  READY: "已完成",
  FAILED: "处理失败",
};
