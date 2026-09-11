<script setup lang="ts">
import { translate } from "@/i18n";
import { onBeforeUnmount, onMounted, ref } from "vue";
import {
  Clock3,
  LoaderCircle,
  CircleCheck,
  CircleAlert,
  RefreshCw,
  RotateCcw,
  Image,
  Eye,
  Pause,
} from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { processingLabels } from "@/config/workspace";
import { useAssetFeed } from "@/composables/useAssetFeed";
import { formatDate } from "@/composables/mediaFormat";
import { usePreferencesStore } from "@/stores/preferences";
import { useWorkspaceStore } from "@/stores/workspace";
import type { ProcessingStatus } from "@/types/media";
import PageHeader from "@/components/workspace/PageHeader.vue";
import DataState from "@/components/workspace/DataState.vue";

const workspace = useWorkspaceStore();
const preferences = usePreferencesStore();
const status = ref<ProcessingStatus>();
const feed = useAssetFeed(() => ({ query: { status: status.value } }));
const { items, loading, loadingMore, refreshing, error, moreError, hasMore } =
  feed;
const retrying = ref(new Set<string>());
const states = [
  { key: "PROCESSING", title: "运行中", icon: LoaderCircle, color: "text-ai" },
  { key: "PENDING", title: "等待中", icon: Clock3, color: "text-warn" },
  { key: "READY", title: "已完成", icon: CircleCheck, color: "text-ok" },
  { key: "FAILED", title: "失败", icon: CircleAlert, color: "text-err" },
] as const;
let polling: number | undefined;
function refresh() {
  void feed.reload();
  void workspace.loadOverview();
}
async function retry(id: string) {
  if (retrying.value.has(id)) return;
  retrying.value.add(id);
  try {
    const result = await mediaApi.retry(id);
    workspace.invalidate();
    workspace.notify(
      result.enqueued
        ? translate("任务已重新投递到处理队列")
        : translate("已重置为待处理；队列恢复连接后将自动补投"),
      result.enqueued ? "success" : "info",
    );
  } catch (cause) {
    workspace.notify(getErrorMessage(cause), "error");
  } finally {
    retrying.value.delete(id);
  }
}
onMounted(() => {
  polling = window.setInterval(() => {
    if (
      preferences.values.autoRefresh &&
      document.visibilityState === "visible" &&
      items.value.length <= 40 &&
      !retrying.value.size &&
      !workspace.selectedAsset
    ) {
      void feed.poll();
      void workspace.loadOverview();
    }
  }, 10_000);
});
onBeforeUnmount(() => window.clearInterval(polling));
</script>

<template>
  <section>
    <PageHeader
      :title="$t('后台任务中心')"
      :description="$t('图片入库处理 · 缩略图生成 · EXIF 元数据提取')"
      ><el-button
        native-type="button"
        disabled
        :title="$t('当前后端不支持暂停或取消运行中的任务')"
      >
        <Pause />{{ $t("暂停全部") }}</el-button
      ><el-button
        native-type="button"
        :disabled="loading || refreshing"
        @click="refresh"
      >
        <RefreshCw :class="{ 'animate-spin': loading || refreshing }" />{{
          $t("刷新")
        }}</el-button
      ></PageHeader
    >
    <div class="space-y-5 px-4 sm:px-6">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          v-for="state in states"
          :key="state.key"
          type="button"
          class="mh-card flex items-center justify-between gap-2 p-4 text-left transition hover:bg-panel2"
          :class="{ '!border-accent/60': status === state.key }"
          :aria-pressed="status === state.key"
          @click="status = status === state.key ? undefined : state.key"
        >
          <span
            ><span class="block text-xs text-soft">{{ $t(state.title) }}</span
            ><span
              class="mt-2 block font-display text-3xl font-semibold tabular-nums"
              >{{ workspace.overview?.statuses[state.key] ?? "—" }}</span
            ></span
          ><span
            class="grid size-10 place-items-center rounded-xl bg-panel2"
            :class="state.color"
            ><component :is="state.icon" class="size-5"
          /></span>
        </button>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          class="mh-chip"
          :aria-pressed="!status"
          @click="status = undefined"
        >
          {{ $t("全部入库任务") }}
        </button>
        <p class="text-[11px] text-faint">
          {{
            $t("{value1} · 仅当前账户的未删除图片", {
              value1:
                preferences.values.autoRefresh && items.length <= 40
                  ? $t("每 10 秒刷新首页")
                  : $t("手动刷新列表"),
            })
          }}
        </p>
      </div>
      <DataState
        v-if="loading || error || !items.length"
        :loading="loading"
        :error="error"
        :icon="CircleCheck"
        :title="$t('这里暂时没有任务')"
        :description="
          $t('上传图片后将自动创建入库任务，完成后可查看缩略图与拍摄信息。')
        "
        @retry="refresh"
      />
      <div v-else class="space-y-3">
        <article
          v-for="asset in items"
          :key="asset.id"
          class="mh-card flex items-start gap-4 p-4"
        >
          <span
            class="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-panel2 text-ai sm:flex"
            ><Image class="size-5"
          /></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-sm font-medium">
                {{ $t("缩略图生成与元数据提取") }}
              </h2>
              <span class="mh-badge" :class="`mh-status-${asset.status}`"
                ><LoaderCircle
                  v-if="asset.status === 'PROCESSING'"
                  class="size-3 animate-spin"
                />{{ $t(processingLabels[asset.status]) }}</span
              >
            </div>
            <p class="mt-1 truncate text-xs text-soft" :title="asset.name">
              {{ asset.name }}
            </p>
            <p class="mt-2 text-[10px] leading-5 text-faint">
              {{
                $t("上传于 {value1} · 已尝试 {value2} 次", {
                  value1: formatDate(asset.createdAt, true),
                  value2: asset.processingAttempts ?? 0,
                })
              }}<span v-if="asset.nextAttemptAt">{{
                $t("· 下次尝试 {value1}", {
                  value1: formatDate(asset.nextAttemptAt, true),
                })
              }}</span>
            </p>
            <div
              v-if="asset.status === 'PROCESSING' || asset.status === 'READY'"
              class="mt-3 h-1 overflow-hidden rounded-full bg-panel3"
            >
              <div
                class="h-full rounded-full"
                :class="
                  asset.status === 'READY'
                    ? 'w-full bg-ok/50'
                    : 'mh-indeterminate w-1/3 bg-ai'
                "
              />
            </div>
            <p
              v-if="asset.processingError"
              class="mt-2 break-words text-xs leading-6 text-err"
            >
              {{ asset.processingError }}
            </p>
          </div>
          <div class="flex shrink-0 flex-col gap-2 sm:flex-row">
            <el-button
              :loading="retrying.has(asset.id)"
              v-if="asset.status === 'FAILED' && workspace.can('asset:edit')"
              native-type="button"
              :disabled="retrying.has(asset.id)"
              @click="retry(asset.id)"
            >
              <RotateCcw v-if="!retrying.has(asset.id)" />{{
                $t("重试")
              }}</el-button
            ><el-button
              text
              circle
              native-type="button"
              :aria-label="$t('查看 {value1}', { value1: asset.name })"
              @click="workspace.selectedAsset = asset"
            >
              <Eye />
            </el-button>
          </div>
        </article>
      </div>
      <p v-if="moreError" class="text-xs text-err" role="alert">
        {{ moreError }}
      </p>
      <div v-if="hasMore" class="flex justify-center">
        <el-button
          :loading="loadingMore"
          native-type="button"
          :disabled="loadingMore || refreshing"
          @click="feed.loadMore"
          >{{ $t("加载更多任务") }}</el-button
        >
      </div>
      <p class="text-[11px] leading-6 text-faint">
        {{
          $t(
            "状态与重试次数来自真实入库记录，处理中不展示虚构的百分比。暂不支持队列暂停、任务取消或自动清理已完成记录。",
          )
        }}
      </p>
    </div>
  </section>
</template>
