<script setup lang="ts">
import { Star, Check, CheckSquare, Play } from "lucide-vue-next";
import { usePreferencesStore } from "@/stores/preferences";
import { useWorkspaceStore } from "@/stores/workspace";
import {
  formatBytes,
  formatDate,
  formatDuration,
} from "@/composables/mediaFormat";
import { processingLabels } from "@/config/workspace";
import type { AssetSummary } from "@/types/media";
import AssetImage from "./AssetImage.vue";

defineProps<{
  items: AssetSummary[];
  selected: Set<string>;
  selecting: boolean;
}>();
defineEmits<{ select: [id: string]; open: [asset: AssetSummary] }>();
const preferences = usePreferencesStore();
const workspace = useWorkspaceStore();

function ratio(asset: AssetSummary) {
  return asset.width && asset.height
    ? Math.max(0.6, Math.min(1.85, asset.width / asset.height))
    : 1.2;
}
</script>

<template>
  <div
    v-if="preferences.values.viewMode === 'grid'"
    class="media-grid"
    :class="{ 'is-dense': preferences.values.denseGrid }"
  >
    <article
      v-for="asset in items"
      :key="asset.id"
      class="media-card mh-enter"
      :class="{
        'is-selected': selected.has(asset.id),
        'is-selecting': selecting,
        'show-names': preferences.values.showNames,
      }"
    >
      <button
        type="button"
        class="relative block w-full"
        :style="{ aspectRatio: ratio(asset) }"
        :aria-label="`查看 ${asset.name}`"
        @click="selecting ? $emit('select', asset.id) : $emit('open', asset)"
      >
        <AssetImage
          :asset-id="asset.id"
          :name="asset.name"
          :trash="asset.deleted"
          :version="asset.status"
          :class="{ 'opacity-60': asset.deleted }"
        />
        <span
          v-if="asset.type === 'VIDEO'"
          class="pointer-events-none absolute top-2 left-10 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-[10px] text-white"
        >
          <Play class="size-3 fill-current" />{{
            formatDuration(asset.durationMs)
          }}
        </span>
        <span class="media-card-caption"
          ><span class="block truncate text-xs font-medium">{{
            asset.name
          }}</span
          ><span class="mt-1 flex gap-1.5"
            ><span
              v-for="tag in asset.tags.slice(0, 2)"
              :key="tag.id"
              class="max-w-24 truncate rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/80"
              >{{ tag.name }}</span
            ><span
              v-if="asset.status !== 'READY'"
              class="text-[10px] text-white/70"
              >{{ processingLabels[asset.status] }}</span
            ></span
          ></span
        >
      </button>
      <button
        class="media-card-selector absolute top-2 left-2 grid size-6 place-items-center rounded-md border border-white/20 bg-black/50 text-white backdrop-blur"
        type="button"
        :class="{ '!bg-accent !text-ink': selected.has(asset.id) }"
        :aria-label="`${selected.has(asset.id) ? '取消选择' : '选择'} ${asset.name}`"
        :aria-pressed="selected.has(asset.id)"
        @click="$emit('select', asset.id)"
      >
        <Check v-if="selected.has(asset.id)" class="size-3.5" /><CheckSquare
          v-else
          class="size-3.5"
        />
      </button>
      <button
        v-if="!asset.deleted && workspace.can('asset:edit')"
        class="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-black/50 text-white/70 backdrop-blur transition-colors hover:text-accent"
        :class="{ '!text-accent': asset.isFavorite }"
        type="button"
        :disabled="workspace.favoriteBusy.has(asset.id)"
        :aria-label="`${asset.isFavorite ? '取消收藏' : '收藏'} ${asset.name}`"
        :aria-pressed="asset.isFavorite"
        @click="workspace.toggleFavorite(asset)"
      >
        <Star class="size-3.5" :class="{ 'fill-current': asset.isFavorite }" />
      </button>
    </article>
  </div>
  <div v-else class="overflow-hidden rounded-xl border border-line bg-panel">
    <div
      class="hidden grid-cols-[28px_1fr_110px_100px_70px_32px] items-center gap-3 border-b border-line bg-panel2 px-4 py-3 text-[11px] text-faint lg:grid"
    >
      <span /><span>文件名称</span><span>处理状态</span><span>上传日期</span
      ><span>大小</span><span />
    </div>
    <article
      v-for="asset in items"
      :key="asset.id"
      class="flex items-center gap-3 border-b border-line px-3 py-3 last:border-0 hover:bg-panel2 lg:grid lg:grid-cols-[28px_1fr_110px_100px_70px_32px] lg:px-4"
      :class="{ 'bg-accent/5': selected.has(asset.id) }"
    >
      <input
        type="checkbox"
        class="mh-checkbox"
        :checked="selected.has(asset.id)"
        :aria-label="`选择 ${asset.name}`"
        @change="$emit('select', asset.id)"
      />
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-3 text-left"
        @click="selecting ? $emit('select', asset.id) : $emit('open', asset)"
      >
        <span class="block size-12 shrink-0 overflow-hidden rounded-lg"
          ><AssetImage
            :asset-id="asset.id"
            :name="asset.name"
            :trash="asset.deleted"
            :version="asset.status" /></span
        ><span class="min-w-0"
          ><span class="block truncate text-xs">{{ asset.name }}</span
          ><span class="mt-1 block truncate text-[10px] text-faint"
            ><span v-if="asset.type === 'VIDEO'"
              >视频 · {{ formatDuration(asset.durationMs) }} · </span
            >{{
              asset.width && asset.height
                ? `${asset.width} × ${asset.height}`
                : asset.mimeType
            }}<span class="lg:hidden">
              · {{ formatBytes(asset.size) }}</span
            ></span
          ></span
        >
      </button>
      <span class="hidden lg:block"
        ><span class="mh-badge" :class="`mh-status-${asset.status}`">{{
          processingLabels[asset.status]
        }}</span></span
      >
      <span class="hidden text-[11px] text-soft lg:block">{{
        formatDate(asset.createdAt)
      }}</span
      ><span class="hidden text-[11px] text-soft lg:block">{{
        formatBytes(asset.size)
      }}</span>
      <button
        v-if="!asset.deleted && workspace.can('asset:edit')"
        type="button"
        class="shrink-0 p-1 text-faint hover:text-accent"
        :class="{ '!text-accent': asset.isFavorite }"
        :disabled="workspace.favoriteBusy.has(asset.id)"
        :aria-label="asset.isFavorite ? '取消收藏' : '收藏'"
        :aria-pressed="asset.isFavorite"
        @click="workspace.toggleFavorite(asset)"
      >
        <Star
          class="size-4"
          :class="{ 'fill-current': asset.isFavorite }"
        /></button
      ><span v-else />
    </article>
  </div>
</template>
