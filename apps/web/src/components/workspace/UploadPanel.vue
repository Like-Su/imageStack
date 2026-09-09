<script setup lang="ts">
import {
  ChevronDown,
  ChevronUp,
  X,
  Upload,
  CircleCheck,
  CircleAlert,
  LoaderCircle,
  RotateCcw,
  Images,
} from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { useUploadsStore } from "@/stores/uploads";
import { formatBytes } from "@/composables/mediaFormat";
const uploads = useUploadsStore();
const labels = {
  queued: "等待上传",
  running: "上传中",
  done: "已上传",
  error: "上传未完成",
  cancelled: "已取消",
};
</script>

<template>
  <aside
    v-if="uploads.open"
    class="fixed right-3 bottom-3 z-40 w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_16px_60px_rgba(0,0,0,.45)]"
    aria-label="上传队列"
  >
    <header class="flex items-center gap-2 border-b border-line px-4 py-3">
      <Upload class="size-4 text-accent" aria-hidden="true" />
      <h2 class="flex-1 text-sm font-semibold">
        上传文件
        <span class="ml-1 text-xs font-normal text-soft"
          >{{ uploads.completed }} / {{ uploads.entries.length }}</span
        >
      </h2>
      <button
        class="text-faint hover:text-ghost"
        type="button"
        :aria-label="uploads.collapsed ? '展开上传队列' : '折叠上传队列'"
        @click="uploads.collapsed = !uploads.collapsed"
      >
        <component
          :is="uploads.collapsed ? ChevronUp : ChevronDown"
          class="size-4"
        />
      </button>
      <button
        class="ml-2 text-faint hover:text-ghost"
        type="button"
        aria-label="隐藏上传队列，上传继续"
        @click="uploads.open = false"
      >
        <X class="size-4" />
      </button>
    </header>
    <div v-if="!uploads.collapsed">
      <div class="max-h-72 space-y-4 overflow-y-auto p-4" aria-live="polite">
        <p
          v-if="!uploads.entries.length"
          class="py-6 text-center text-xs text-soft"
        >
          选择图片，开始建立你的媒体库。
        </p>
        <div
          v-for="entry in uploads.entries"
          :key="entry.id"
          class="flex gap-3"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-lg bg-panel2"
          >
            <CircleCheck v-if="entry.state === 'done'" class="size-4 text-ok" />
            <CircleAlert
              v-else-if="entry.state === 'error'"
              class="size-4 text-err"
            />
            <LoaderCircle
              v-else-if="entry.state === 'running'"
              class="size-4 animate-spin text-accent"
            />
            <Images v-else class="size-4 text-faint" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs" :title="entry.name">{{ entry.name }}</p>
            <div class="mt-1 flex justify-between gap-2 text-[10px] text-soft">
              <span>{{ formatBytes(entry.size) }}</span
              ><span>{{ labels[entry.state] }}</span>
            </div>
            <div
              v-if="entry.state === 'running'"
              class="mt-2 h-1 overflow-hidden rounded-full bg-panel3"
            >
              <div
                class="mh-indeterminate h-full w-1/3 rounded-full bg-accent"
              />
            </div>
            <p v-if="entry.error" class="mt-1 text-[11px] leading-5 text-err">
              {{ entry.error }}
            </p>
          </div>
          <button
            v-if="entry.state === 'error' && entry.file"
            class="self-start text-soft hover:text-accent"
            type="button"
            :aria-label="`重试 ${entry.name}`"
            @click="uploads.retry(entry)"
          >
            <RotateCcw class="size-3.5" />
          </button>
          <button
            v-if="entry.state === 'queued'"
            class="self-start text-soft hover:text-err"
            type="button"
            :aria-label="`取消上传 ${entry.name}`"
            @click="uploads.cancel(entry)"
          >
            <X class="size-3.5" />
          </button>
        </div>
      </div>
      <footer class="border-t border-line bg-panel2/50 p-4">
        <p class="text-[10px] leading-5 text-faint">
          JPEG / PNG / WebP · 单张 ≤ 10 MB、2000 万像素<br />上传后自动生成缩略图并提取
          EXIF，不支持分片续传。
        </p>
        <div class="mt-3 flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            class="text-soft hover:text-ghost"
            @click="uploads.clearFinished"
          >
            清理已完成
          </button>
          <RouterLink
            class="text-ai"
            :to="{ name: 'tasks' }"
            @click="uploads.open = false"
            >查看处理任务</RouterLink
          >
          <button
            type="button"
            class="text-accent"
            @click="uploads.chooseFiles"
          >
            继续上传
          </button>
        </div>
      </footer>
    </div>
  </aside>
</template>
