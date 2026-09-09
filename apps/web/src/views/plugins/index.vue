<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import {
  Puzzle,
  HardDrive,
  Image,
  ListTodo,
  Search,
  MapPin,
  Sparkles,
  ScanFace,
  ScanText,
  Cloud,
  Video,
  ShieldCheck,
  Bell,
  DatabaseBackup,
  RefreshCw,
  Info,
} from "lucide-vue-next";
import { systemApi } from "@/api/system";
import { useRemoteData } from "@/composables/useRemoteData";
import type { ExtensionCapability } from "@/types/system";
import PageHeader from "@/components/workspace/PageHeader.vue";
import DataState from "@/components/workspace/DataState.vue";
import AppModal from "@/components/workspace/AppModal.vue";

const { data, loading, error, refresh } = useRemoteData(systemApi.capabilities);
const filter = ref("all");
const selected = ref<ExtensionCapability>();
const filters = [
  { value: "all", label: "全部能力" },
  { value: "builtin", label: "已内置" },
  { value: "unavailable", label: "尚未接入" },
];
const filtered = computed(() =>
  (data.value?.extensions ?? []).filter(
    (extension) =>
      filter.value === "all" ||
      extension.builtin === (filter.value === "builtin"),
  ),
);
const icons: Record<string, Component> = {
  "local-storage": HardDrive,
  thumbnails: Image,
  queue: ListTodo,
  "keyword-search": Search,
  gps: MapPin,
  caption: Sparkles,
  "vector-search": Sparkles,
  face: ScanFace,
  ocr: ScanText,
  s3: Cloud,
  video: Video,
  sso: ShieldCheck,
  notifications: Bell,
  backup: DatabaseBackup,
};
</script>

<template>
  <section>
    <PageHeader
      title="插件与扩展"
      description="按需拓展媒体库，每项能力的边界都清晰可见"
      ><button
        type="button"
        class="mh-button"
        :disabled="loading"
        @click="refresh"
      >
        <RefreshCw :class="{ 'animate-spin': loading }" />刷新能力
      </button></PageHeader
    >
    <div class="px-4 sm:px-6">
      <div
        class="mb-5 flex items-start gap-3 rounded-xl border border-line bg-panel p-4"
      >
        <Info class="mt-0.5 size-4 shrink-0 text-ai" />
        <p class="text-xs leading-6 text-soft">
          能力清单由后端返回。「已内置」表示代码已集成，不是运行健康检查。当前没有插件热安装或启停接口，不能在网页中假装打开未部署的服务。
        </p>
      </div>
      <div class="mb-5 flex flex-wrap gap-2">
        <button
          v-for="item in filters"
          :key="item.value"
          type="button"
          class="mh-chip"
          :aria-pressed="filter === item.value"
          @click="filter = item.value"
        >
          {{ item.label }}
        </button>
      </div>
      <DataState
        v-if="loading || error"
        :loading="loading"
        :error="error"
        :icon="Puzzle"
        @retry="refresh"
      />
      <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="extension in filtered"
          :key="extension.id"
          class="mh-card flex flex-col p-5"
        >
          <div class="flex items-start justify-between gap-3">
            <span
              class="grid size-10 place-items-center rounded-xl"
              :class="
                extension.builtin
                  ? 'bg-accent/10 text-accent'
                  : 'bg-ai/10 text-ai'
              "
              ><component
                :is="icons[extension.id] ?? Puzzle"
                class="size-5" /></span
            ><button
              type="button"
              class="mh-switch"
              role="switch"
              :aria-checked="extension.builtin"
              :aria-label="`${extension.name}：${extension.builtin ? '已内置，不支持网页关闭' : '尚未接入，不可启用'}`"
              disabled
              :title="
                extension.builtin
                  ? '内置能力随服务器部署，不支持网页关闭'
                  : '后端尚未接入此能力'
              "
            />
          </div>
          <h2 class="mt-4 text-sm font-semibold">{{ extension.name }}</h2>
          <p class="mt-2 flex-1 text-xs leading-6 text-soft">
            {{ extension.description }}
          </p>
          <div
            class="mt-5 flex items-center justify-between gap-2 border-t border-line pt-3"
          >
            <span
              class="text-[10px]"
              :class="extension.builtin ? 'text-ok' : 'text-faint'"
              >{{ extension.builtin ? "已内置" : "尚未接入" }} ·
              {{ extension.category }}</span
            ><button
              type="button"
              class="text-xs text-soft hover:text-accent"
              @click="selected = extension"
            >
              查看详情
            </button>
          </div>
        </article>
      </div>
    </div>
    <AppModal
      :open="Boolean(selected)"
      :title="selected?.name ?? '扩展详情'"
      @update:open="selected = undefined"
      ><div class="p-5">
        <span
          class="mh-badge"
          :class="selected?.builtin ? 'mh-status-READY' : ''"
          >{{ selected?.builtin ? "内置能力" : "尚未接入" }}</span
        >
        <p class="mt-4 text-sm leading-7 text-soft">{{ selected?.detail }}</p>
      </div></AppModal
    >
  </section>
</template>
