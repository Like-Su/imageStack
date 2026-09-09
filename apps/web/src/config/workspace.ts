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
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp";

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
