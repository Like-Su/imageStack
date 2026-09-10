<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  CalendarDays,
  CheckSquare,
  FolderPlus,
  FolderMinus,
  Image,
  LoaderCircle,
  RotateCcw,
  Tags,
  Tag,
  Trash2,
  Upload,
  X,
  RefreshCw,
} from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useAssetFeed } from "@/composables/useAssetFeed";
import { useAssetActions } from "@/composables/useAssetActions";
import { useUploadsStore } from "@/stores/uploads";
import { useWorkspaceStore } from "@/stores/workspace";
import type { AssetQuery } from "@/types/media";
import DataState from "@/components/workspace/DataState.vue";
import AssetGrid from "./AssetGrid.vue";
import AlbumPicker from "./AlbumPicker.vue";
import TagAssignmentDialog from "./TagAssignmentDialog.vue";

const props = withDefaults(
  defineProps<{
    query?: AssetQuery;
    trash?: boolean;
    search?: string;
    emptyTitle?: string;
    emptyDescription?: string;
  }>(),
  { query: () => ({}), trash: false },
);
const workspace = useWorkspaceStore();
const uploads = useUploadsStore();
const { busy, moveToTrash, restore, purge } = useAssetActions();
const preset = ref("all");
const currentYear = new Date().getFullYear();
const presets = [
  { id: "all", label: "全部" },
  { id: "image", label: "图片" },
  { id: "video", label: "视频" },
  { id: "recent", label: "最近上传" },
  { id: "uncategorized", label: "未分类" },
  { id: "large", label: "大文件" },
  { id: "year", label: String(currentYear) },
];
const showTime = ref(false);
const from = ref("");
const through = ref("");
const timeField = ref<"createdAt" | "takenAt">("createdAt");
const range = ref<Pick<AssetQuery, "from" | "to" | "timeField">>({});
const rangeError = ref("");
const selecting = ref(false);
const selected = ref(new Set<string>());
const selectedIds = computed(() => Array.from(selected.value));
const albumPicker = ref(false);
const tagPicker = ref(false);
const dialogIds = ref<string[]>([]);
const collectionBusy = ref(false);
const isBusy = computed(() => busy.value || collectionBusy.value);

const filters = computed<AssetQuery>(() => ({
  ...props.query,
  ...range.value,
  ...(preset.value === "image" ? { type: "image" as const } : {}),
  ...(preset.value === "video" ? { type: "video" as const } : {}),
  ...(preset.value === "recent"
    ? {
        from: new Date(Date.now() - 7 * 86400_000).toISOString(),
        timeField: "createdAt" as const,
      }
    : {}),
  ...(preset.value === "uncategorized" ? { uncategorized: true } : {}),
  ...(preset.value === "large" ? { minSize: 5 * 1024 * 1024 } : {}),
  ...(preset.value === "year" ? { year: currentYear } : {}),
}));
const feed = useAssetFeed(() => ({
  query: filters.value,
  trash: props.trash,
  search: props.search,
}));
const { items, loading, loadingMore, error, moreError, hasMore, tookMs } = feed;
const hasFilters = computed(
  () => preset.value !== "all" || Boolean(range.value.from || range.value.to),
);

watch(items, (assets) => {
  const existing = new Set(assets.map((asset) => asset.id));
  selected.value = new Set(
    [...selected.value].filter((id) => existing.has(id)),
  );
});

function resetFilters() {
  preset.value = "all";
  range.value = {};
  from.value = "";
  through.value = "";
  rangeError.value = "";
}
function applyRange() {
  if (from.value && through.value && from.value > through.value) {
    rangeError.value = "开始日期不能晚于结束日期";
    return;
  }
  let to: string | undefined;
  if (through.value) {
    const date = new Date(`${through.value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) {
      rangeError.value = "请选择有效日期";
      return;
    }
    to = date.toISOString();
  }
  range.value = {
    from: from.value || undefined,
    to,
    timeField: timeField.value,
  };
  preset.value = "all";
  rangeError.value = "";
}
function toggle(id: string) {
  if (isBusy.value) return;
  selecting.value = true;
  if (selected.value.has(id)) selected.value.delete(id);
  else if (selected.value.size < 100) selected.value.add(id);
  else workspace.notify("一次最多选择 100 项媒体，请分批操作。", "info");
}
function selectLoaded() {
  selected.value = new Set(items.value.slice(0, 100).map((asset) => asset.id));
}
function exitSelection() {
  selected.value.clear();
  selecting.value = false;
}
function openAlbumPicker() {
  dialogIds.value = [...selected.value];
  albumPicker.value = true;
}
function openTagPicker() {
  dialogIds.value = [...selected.value];
  tagPicker.value = true;
}

async function removeFromAlbum() {
  if (!props.query.albumId || isBusy.value || !selectedIds.value.length) return;
  const ids = [...selectedIds.value];
  const albumId = props.query.albumId;
  collectionBusy.value = true;
  try {
    if (
      !(await workspace.confirm({
        title: "从相册移除？",
        message: `移除 ${ids.length} 项相册关联。媒体仍保留在图库，不会删除原文件。`,
        confirmLabel: "移除",
      }))
    )
      return;
    await workspace.perform(
      () => mediaApi.removeFromAlbum(albumId, ids),
      "已从相册移除，原图仍保留在图库",
    );
  } finally {
    collectionBusy.value = false;
  }
}

async function setCover() {
  if (!props.query.albumId || selectedIds.value.length !== 1 || isBusy.value)
    return;
  collectionBusy.value = true;
  const albumId = props.query.albumId;
  const coverAssetId = selectedIds.value[0]!;
  try {
    await workspace.perform(
      () => mediaApi.updateAlbum(albumId, { coverAssetId }),
      "已更新相册封面",
    );
  } finally {
    collectionBusy.value = false;
  }
}

async function removeFromTag() {
  if (!props.query.tagId || isBusy.value || !selectedIds.value.length) return;
  const tagId = props.query.tagId;
  const ids = [...selectedIds.value];
  collectionBusy.value = true;
  let removed = 0;
  try {
    if (
      !(await workspace.confirm({
        title: "解除分组关联？",
        message: `将 ${ids.length} 项媒体从当前标签或人物分组中移除，原图和其他标签保留。`,
        confirmLabel: "解除关联",
      }))
    )
      return;
    for (const id of ids) {
      await mediaApi.removeTag(id, tagId);
      removed += 1;
    }
    workspace.notify(`已解除 ${removed} 项媒体的分组关联`);
  } catch (cause) {
    workspace.notify(
      `已解除 ${removed} 项；${getErrorMessage(cause)}`,
      "error",
    );
  } finally {
    if (removed) workspace.invalidate();
    collectionBusy.value = false;
  }
}
</script>

<template>
  <div>
    <div
      class="sticky top-0 z-20 border-y border-line bg-ink/95 px-4 py-3 backdrop-blur sm:px-6"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5"
          aria-label="媒体筛选"
        >
          <button
            v-for="filter in presets"
            :key="filter.id"
            type="button"
            class="mh-chip"
            :aria-pressed="preset === filter.id"
            :disabled="isBusy"
            :title="
              filter.id === 'recent'
                ? '最近 7 天上传'
                : filter.id === 'large'
                  ? '原文件大于等于 5 MB'
                  : filter.id === 'uncategorized'
                    ? '尚未加入相册'
                    : filter.id === 'video'
                      ? '筛选已上传的 MP4 / MOV / MKV 视频'
                      : undefined
            "
            @click="preset = filter.id"
          >
            {{ filter.label }}
          </button>
        </div>
        <button
          class="mh-icon-button"
          type="button"
          aria-label="时间范围筛选"
          :aria-expanded="showTime"
          :class="{ '!text-accent': range.from || range.to }"
          @click="showTime = !showTime"
        >
          <CalendarDays />
        </button>
        <button
          class="mh-icon-button"
          type="button"
          :aria-label="selecting ? '退出多选' : '批量选择'"
          :aria-pressed="selecting"
          :disabled="isBusy"
          @click="selecting ? exitSelection() : (selecting = true)"
        >
          <CheckSquare />
        </button>
        <button
          class="mh-icon-button hidden sm:flex"
          type="button"
          aria-label="刷新媒体列表"
          :disabled="loading || isBusy"
          @click="feed.reload"
        >
          <RefreshCw :class="{ 'animate-spin': loading }" />
        </button>
      </div>
      <form
        v-if="showTime"
        class="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3"
        @submit.prevent="applyRange"
      >
        <label class="mh-label"
          >时间字段<select v-model="timeField" class="mh-input !w-auto">
            <option value="createdAt">上传时间</option>
            <option value="takenAt">拍摄时间（EXIF）</option>
          </select></label
        >
        <label class="mh-label"
          >开始日期（UTC）<input
            v-model="from"
            type="date"
            class="mh-input !w-auto"
            max="9999-12-30"
        /></label>
        <label class="mh-label"
          >结束日期（含当日）<input
            v-model="through"
            type="date"
            class="mh-input !w-auto"
            max="9999-12-30"
        /></label>
        <button type="submit" class="mh-button" :disabled="isBusy">
          应用范围</button
        ><button
          type="button"
          class="mh-button"
          :disabled="isBusy"
          @click="resetFilters"
        >
          重置筛选
        </button>
        <p v-if="rangeError" class="w-full text-xs text-err" role="alert">
          {{ rangeError }}
        </p>
      </form>
      <div
        v-if="selecting"
        class="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3"
      >
        <span class="mr-1 text-xs text-accent"
          >已选择 {{ selected.size }} 项</span
        >
        <button
          type="button"
          class="mh-button"
          :disabled="isBusy || !items.length"
          @click="selectLoaded"
        >
          选择已加载项（最多 100）
        </button>
        <template v-if="selected.size">
          <template v-if="trash"
            ><button
              v-if="workspace.can('asset:delete')"
              type="button"
              class="mh-button"
              :disabled="isBusy"
              @click="restore(selectedIds)"
            >
              <RotateCcw />恢复</button
            ><button
              v-if="workspace.can('asset:delete')"
              type="button"
              class="mh-button mh-button-danger"
              :disabled="isBusy"
              @click="purge(selectedIds)"
            >
              <Trash2 />永久删除
            </button></template
          >
          <template v-else>
            <button
              v-if="workspace.can('asset:category')"
              type="button"
              class="mh-button"
              :disabled="isBusy"
              @click="openAlbumPicker"
            >
              <FolderPlus />添加到相册
            </button>
            <button
              v-if="workspace.can('asset:tag')"
              type="button"
              class="mh-button"
              :disabled="isBusy"
              @click="openTagPicker"
            >
              <Tags />标签 / 人物
            </button>
            <button
              v-if="query.tagId && workspace.can('asset:tag')"
              type="button"
              class="mh-button"
              :disabled="isBusy"
              @click="removeFromTag"
            >
              <Tag />解除分组关联
            </button>
            <button
              v-if="query.albumId && workspace.can('asset:category')"
              type="button"
              class="mh-button"
              :disabled="isBusy"
              @click="removeFromAlbum"
            >
              <FolderMinus />从相册移除
            </button>
            <button
              v-if="
                query.albumId &&
                selected.size === 1 &&
                workspace.can('asset:category')
              "
              type="button"
              class="mh-button"
              :disabled="isBusy"
              @click="setCover"
            >
              <Image />设为封面
            </button>
            <button
              v-if="workspace.can('asset:delete')"
              type="button"
              class="mh-button mh-button-danger"
              :disabled="isBusy"
              @click="moveToTrash(selectedIds)"
            >
              <Trash2 />移入回收站
            </button>
          </template>
        </template>
        <button
          type="button"
          class="ml-auto text-soft"
          aria-label="退出多选"
          :disabled="isBusy"
          @click="exitSelection"
        >
          <X class="size-4" />
        </button>
      </div>
    </div>
    <div class="px-4 py-5 sm:px-6">
      <p
        v-if="search !== undefined && !loading && !error"
        class="mb-4 text-xs text-soft"
      >
        已加载 <span class="text-ghost">{{ items.length }}</span> 项结果 ·
        关键词匹配 · 本次查询 {{ tookMs ?? 0 }} ms · 按上传时间倒序
      </p>
      <div
        v-if="loading"
        class="media-grid"
        aria-label="正在加载媒体"
        aria-busy="true"
      >
        <div
          v-for="index in 12"
          :key="index"
          class="animate-pulse rounded-xl border border-line bg-panel2"
          :style="{ height: `${[190, 240, 180, 220][index % 4]}px` }"
        />
      </div>
      <DataState
        v-else-if="error || !items.length"
        :error="error"
        :title="
          hasFilters
            ? '没有符合筛选条件的媒体'
            : (emptyTitle ?? '你的图库，等待第一张照片')
        "
        :description="
          hasFilters
            ? '尝试更换筛选条件，或检查图片是否包含拍摄时间。'
            : (emptyDescription ??
              '上传照片，将重要的回忆与创作整理在同一个地方。')
        "
        @retry="feed.reload"
      >
        <button
          v-if="hasFilters"
          class="mh-button"
          type="button"
          @click="resetFilters"
        >
          清除筛选条件
        </button>
        <button
          v-else-if="
            !trash &&
            !query.albumId &&
            !query.tagId &&
            !query.placeId &&
            !query.favorite &&
            search === undefined &&
            workspace.can('upload:create')
          "
          class="mh-button mh-button-primary"
          type="button"
          @click="uploads.chooseFiles"
        >
          <Upload />上传第一张照片
        </button>
      </DataState>
      <AssetGrid
        v-else
        :items="items"
        :selected="selected"
        :selecting="selecting"
        @select="toggle"
        @open="workspace.selectedAsset = $event"
      />
      <div
        v-if="items.length"
        class="mt-5 flex flex-col items-center gap-3 py-2"
      >
        <p v-if="moreError" class="text-xs text-err" role="alert">
          {{ moreError }}
        </p>
        <button
          v-if="hasMore"
          type="button"
          class="mh-button min-w-36"
          :disabled="loadingMore || isBusy"
          @click="feed.loadMore"
        >
          <LoaderCircle v-if="loadingMore" class="animate-spin" />{{
            moreError ? "重试加载更多" : loadingMore ? "正在加载…" : "加载更多"
          }}</button
        ><span class="text-[11px] text-faint"
          >已显示 {{ items.length }} 项{{ hasMore ? "" : " · 已加载全部" }} ·
          最新上传优先</span
        >
      </div>
    </div>
    <AlbumPicker
      v-if="albumPicker"
      :asset-ids="dialogIds"
      @close="albumPicker = false"
      @saved="exitSelection"
    />
    <TagAssignmentDialog
      v-if="tagPicker"
      :asset-ids="dialogIds"
      @close="tagPicker = false"
      @saved="exitSelection"
    />
  </div>
</template>
