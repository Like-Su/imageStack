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
  ShieldCheck,
  UserCog,
  KeyRound,
} from "lucide-vue-next";
import type { MediaType } from "@/types/media";

export const PERSON_TAG_PREFIX = "人物:";
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
export const UPLOAD_IMAGE_LABEL =
  "JPEG（含 JFIF / PJPEG / PJP）、PNG / APNG、WebP、GIF、AVIF、SVG";
export const UPLOAD_VIDEO_LABEL = "MP4 / MOV / MKV";
export const UPLOAD_FILE_LABEL = "文档、压缩包、音频及其他文件";

export function uploadMediaKind(fileName: string): "image" | "video" | "file" {
  const extension = /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase() ?? "";
  if (imageExtensions.includes(extension)) return "image";
  if (videoExtensions.includes(extension)) return "video";
  return "file";
}

export const mediaTypeLabels: Record<MediaType, string> = {
  IMAGE: "图片",
  VIDEO: "视频",
  AUDIO: "音频",
  DOCUMENT: "文档",
  ARCHIVE: "压缩包",
  OTHER: "其他文件",
};

export function isVisualMedia(type: MediaType) {
  return type === "IMAGE" || type === "VIDEO";
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
  {
    label: "访问管理",
    adminOnly: true,
    items: [
      { name: "admin-users", label: "用户管理", icon: UserCog },
      { name: "admin-roles", label: "角色管理", icon: ShieldCheck },
      { name: "admin-permissions", label: "权限管理", icon: KeyRound },
    ],
  },
] as const;

export const processingLabels = {
  PENDING: "等待处理",
  PROCESSING: "正在处理",
  READY: "已完成",
  FAILED: "处理失败",
};
