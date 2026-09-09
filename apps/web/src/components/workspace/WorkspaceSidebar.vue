<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { Aperture, HardDrive, X } from "lucide-vue-next";
import { navigation } from "@/config/workspace";
import { useWorkspaceStore } from "@/stores/workspace";
import { formatBytes } from "@/composables/mediaFormat";

defineProps<{ mobile?: boolean }>();
const emit = defineEmits<{ navigate: [] }>();
const route = useRoute();
const workspace = useWorkspaceStore();
const selected = computed(() => route.meta.section ?? route.name);
const totalBytes = computed(
  () =>
    Number(workspace.overview?.bytes ?? 0) +
    Number(workspace.overview?.trashBytes ?? 0),
);
const activeRatio = computed(() =>
  totalBytes.value
    ? (Number(workspace.overview?.bytes ?? 0) / totalBytes.value) * 100
    : 0,
);
</script>

<template>
  <div class="workspace-sidebar h-full">
    <div
      class="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-5"
    >
      <RouterLink
        :to="{ name: 'home' }"
        class="flex items-center gap-2.5"
        aria-label="Media Hub 图库"
        @click="emit('navigate')"
      >
        <span
          class="grid size-9 place-items-center rounded-xl bg-accent text-[#0d0f12] shadow-[0_6px_20px_-6px_rgba(255,106,69,.7)]"
          ><Aperture class="size-5"
        /></span>
        <span class="leading-tight"
          ><span class="block font-display text-[15px] font-bold tracking-tight"
            >Media Hub</span
          ><span class="block text-[10px] text-faint"
            >Local · AI · Private</span
          ></span
        >
      </RouterLink>
      <button
        v-if="mobile"
        type="button"
        class="ml-auto text-soft"
        aria-label="关闭导航"
        @click="emit('navigate')"
      >
        <X class="size-4" />
      </button>
    </div>
    <nav
      class="flex-1 space-y-5 overflow-y-auto px-3 py-4"
      aria-label="媒体库导航"
    >
      <div v-for="group in navigation" :key="group.label">
        <p class="mb-2 px-3 text-[10px] font-medium tracking-wider text-faint">
          {{ group.label }}
        </p>
        <div class="space-y-1">
          <RouterLink
            v-for="item in group.items"
            :key="item.name"
            :to="{ name: item.name }"
            class="relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] transition-colors"
            :class="
              selected === item.name
                ? 'bg-panel3 text-ghost'
                : 'text-soft hover:bg-panel2 hover:text-ghost'
            "
            :aria-current="selected === item.name ? 'page' : undefined"
            @click="emit('navigate')"
          >
            <span
              v-if="selected === item.name"
              class="absolute top-3 bottom-3 left-0 w-0.5 rounded-full bg-accent"
            />
            <component
              :is="item.icon"
              class="size-[18px] shrink-0"
              :class="
                selected === item.name
                  ? 'text-accent'
                  : item.name === 'search'
                    ? 'text-ai'
                    : ''
              "
              aria-hidden="true"
            />
            <span>{{ item.label }}</span>
            <span
              v-if="'count' in item && workspace.overview"
              class="ml-auto text-[10px] tabular-nums text-faint"
              >{{ workspace.overview[item.count].toLocaleString() }}</span
            >
            <span
              v-else-if="item.name === 'tasks' && workspace.pendingTasks"
              class="ml-auto rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent"
              >{{ workspace.pendingTasks }}</span
            >
          </RouterLink>
        </div>
      </div>
    </nav>
    <div class="shrink-0 border-t border-line p-3">
      <div class="rounded-xl bg-panel2 p-3">
        <div class="flex items-center justify-between text-[11px] text-soft">
          <span class="flex items-center gap-1.5"
            ><HardDrive class="size-3.5" />原图存储</span
          ><span class="text-ghost">{{
            workspace.overview ? formatBytes(totalBytes) : "—"
          }}</span>
        </div>
        <div
          class="mt-2 flex h-1.5 overflow-hidden rounded-full bg-panel3"
          aria-hidden="true"
        >
          <div
            class="bg-gradient-to-r from-accent to-accent2"
            :style="{ width: `${activeRatio}%` }"
          />
          <div v-if="totalBytes" class="flex-1 bg-faint" />
        </div>
        <p class="mt-2 text-[10px] leading-5 text-faint">
          当前账户 · 图库与回收站<br />不含缩略图，不代表磁盘总容量
        </p>
        <button
          v-if="workspace.overviewError"
          type="button"
          class="mt-1 text-[10px] text-err"
          :title="workspace.overviewError"
          @click="workspace.loadOverview"
        >
          统计获取失败，点击重试
        </button>
      </div>
    </div>
  </div>
</template>
