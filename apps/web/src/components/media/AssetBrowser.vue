<script setup lang="ts">
import { translate } from "@/i18n";
import { computed, ref, watch } from "vue";
import {
  CalendarDays,
  CheckSquare,
  FolderPlus,
  FolderMinus,
  Image,
  RotateCcw,
  Tags,
  Tag,
  Trash2,
  Upload,
  X,
  RefreshCw,
  Pencil,
} from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useAssetFeed } from "@/composables/useAssetFeed";
import { useAssetActions } from "@/composables/useAssetActions";
import { useUploadsStore } from "@/stores/uploads";
import { useWorkspaceStore } from "@/stores/workspace";
import type { AssetQuery, AssetSummary } from "@/types/media";
import DataState from "@/components/workspace/DataState.vue";
import AssetGrid from "./AssetGrid.vue";
import AlbumPicker from "./AlbumPicker.vue";
import TagAssignmentDialog from "./TagAssignmentDialog.vue";
import RenameAssetDialog from "./RenameAssetDialog.vue";

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
const { busy, moveToTrash, restore, purge } = useAssetActions(
  () => items.value,
);
const preset = ref("all");
const currentYear = new Date().getFullYear();
function disabledDate(date: Date) {
  return (
    date.getFullYear() < 1 || date.getTime() >= new Date(9999, 11, 31).getTime()
  );
}

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
const renamingAsset = ref<AssetSummary | null>(null);
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
    rangeError.value = translate("开始日期不能晚于结束日期");
    return;
  }
  let to: string | undefined;
  if (through.value) {
    const date = new Date(`${through.value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) {
      rangeError.value = translate("请选择有效日期");
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
  else
    workspace.notify(
      translate("一次最多选择 100 项媒体，请分批操作。"),
      "info",
    );
}
function selectLoaded() {
  selected.value = new Set(items.value.slice(0, 100).map((asset) => asset.id));
}
function exitSelection() {
  selected.value.clear();
  selecting.value = false;
}
function openRenameDialog() {
  if (isBusy.value || selected.value.size !== 1) return;
  renamingAsset.value =
    items.value.find((asset) => selected.value.has(asset.id)) ?? null;
}
function openAlbumPicker() {
  workspace.rememberAssets(
    items.value.filter((asset) => selected.value.has(asset.id)),
  );
  dialogIds.value = [...selected.value];
  albumPicker.value = true;
}
function openTagPicker() {
  workspace.rememberAssets(
    items.value.filter((asset) => selected.value.has(asset.id)),
  );
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
        title: translate("从相册移除？"),
        message: translate(
          "移除 {value1} 项相册关联。媒体仍保留在图库，不会删除原文件。",
          { value1: ids.length },
        ),
        confirmLabel: translate("移除"),
      }))
    )
      return;
    await workspace.perform(
      () => mediaApi.removeFromAlbum(albumId, ids),
      translate("已从相册移除，原图仍保留在图库"),
      (result) => workspace.updateAlbumMembers(result.album, ids, false),
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
      translate("已更新相册封面"),
      (album) => workspace.updateAlbum(album),
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
  workspace.beginChanges();
  try {
    if (
      !(await workspace.confirm({
        title: translate("解除分组关联？"),
        message: translate(
          "将 {value1} 项媒体从当前标签或人物分组中移除，原图和其他标签保留。",
          { value1: ids.length },
        ),
        confirmLabel: translate("解除关联"),
      }))
    )
      return;
    const result = await mediaApi.removeTagBatch(ids, tagId);
    workspace.removeAssetsTag(ids, result.tag);
    removed = ids.length;
    workspace.notify(
      translate("已解除 {value1} 项媒体的分组关联", { value1: removed }),
    );
  } catch (cause) {
    workspace.notify(
      translate("已解除 {value1} 项；{value2}", {
        value1: removed,
        value2: getErrorMessage(cause),
      }),
      "error",
    );
  } finally {
    workspace.endChanges();
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
          :aria-label="$t('媒体筛选')"
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
                ? $t('最近 7 天上传')
                : filter.id === 'large'
                  ? $t('原文件大于等于 5 MB')
                  : filter.id === 'uncategorized'
                    ? $t('尚未加入相册')
                    : filter.id === 'video'
                      ? $t('筛选已上传的 MP4 / MOV / MKV 视频')
                      : undefined
            "
            @click="preset = filter.id"
          >
            {{ $t(filter.label) }}
          </button>
        </div>
        <el-button
          text
          circle
          native-type="button"
          :aria-label="$t('时间范围筛选')"
          :aria-expanded="showTime"
          :class="{ '!text-accent': range.from || range.to }"
          @click="showTime = !showTime"
        >
          <CalendarDays />
        </el-button>
        <el-button
          text
          circle
          native-type="button"
          :aria-label="selecting ? $t('退出多选') : $t('批量选择')"
          :aria-pressed="selecting"
          :disabled="isBusy"
          @click="selecting ? exitSelection() : (selecting = true)"
        >
          <CheckSquare />
        </el-button>
        <el-button
          text
          circle
          class="hidden sm:flex"
          native-type="button"
          :aria-label="$t('刷新媒体列表')"
          :disabled="loading || isBusy"
          @click="feed.reload"
        >
          <RefreshCw :class="{ 'animate-spin': loading }" />
        </el-button>
      </div>
      <form
        v-if="showTime"
        class="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3"
        @submit.prevent="applyRange"
      >
        <label class="mh-label"
          >{{ $t("时间字段")
          }}<el-select v-model="timeField" class="min-w-36">
            <el-option :label="$t('上传时间')" value="createdAt"></el-option>
            <el-option
              :label="$t('拍摄时间（EXIF）')"
              value="takenAt"
            ></el-option> </el-select
        ></label>
        <label class="mh-label"
          >{{ $t("开始日期（UTC）")
          }}<el-date-picker
            :model-value="from"
            @update:model-value="
              from = typeof $event === 'string' ? $event : ''
            "
            type="date"
            value-format="YYYY-MM-DD"
            :disabled-date="disabledDate"
        /></label>
        <label class="mh-label"
          >{{ $t("结束日期（含当日）")
          }}<el-date-picker
            :model-value="through"
            @update:model-value="
              through = typeof $event === 'string' ? $event : ''
            "
            type="date"
            value-format="YYYY-MM-DD"
            :disabled-date="disabledDate"
        /></label>
        <el-button native-type="submit" :disabled="isBusy">{{
          $t("应用范围")
        }}</el-button
        ><el-button
          native-type="button"
          :disabled="isBusy"
          @click="resetFilters"
          >{{ $t("重置筛选") }}</el-button
        >
        <p v-if="rangeError" class="w-full text-xs text-err" role="alert">
          {{ rangeError }}
        </p>
      </form>
      <div
        v-if="selecting"
        class="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3"
      >
        <span class="mr-1 text-xs text-accent">{{
          $t("已选择 {value1} 项", { value1: selected.size })
        }}</span>
        <el-button
          native-type="button"
          :disabled="isBusy || !items.length"
          @click="selectLoaded"
          >{{ $t("选择已加载项（最多 100）") }}</el-button
        >
        <template v-if="selected.size">
          <template v-if="trash"
            ><el-button
              v-if="workspace.can('asset:delete')"
              native-type="button"
              :disabled="isBusy"
              @click="restore(selectedIds)"
            >
              <RotateCcw />{{ $t("恢复") }}</el-button
            ><el-button
              type="danger"
              plain
              v-if="workspace.can('asset:delete')"
              native-type="button"
              :disabled="isBusy"
              @click="purge(selectedIds)"
            >
              <Trash2 />{{ $t("永久删除") }}</el-button
            ></template
          >
          <template v-else>
            <el-button
              v-if="selected.size === 1 && workspace.can('asset:edit')"
              native-type="button"
              :disabled="isBusy"
              @click="openRenameDialog"
            >
              <Pencil />{{ $t("重命名") }}
            </el-button>
            <el-button
              v-if="workspace.can('asset:category')"
              native-type="button"
              :disabled="isBusy"
              @click="openAlbumPicker"
            >
              <FolderPlus />{{ $t("添加到相册") }}</el-button
            >
            <el-button
              v-if="workspace.can('asset:tag')"
              native-type="button"
              :disabled="isBusy"
              @click="openTagPicker"
            >
              <Tags />{{ $t("标签 / 人物") }}</el-button
            >
            <el-button
              v-if="query.tagId && workspace.can('asset:tag')"
              native-type="button"
              :disabled="isBusy"
              @click="removeFromTag"
            >
              <Tag />{{ $t("解除分组关联") }}</el-button
            >
            <el-button
              v-if="query.albumId && workspace.can('asset:category')"
              native-type="button"
              :disabled="isBusy"
              @click="removeFromAlbum"
            >
              <FolderMinus />{{ $t("从相册移除") }}</el-button
            >
            <el-button
              v-if="
                query.albumId &&
                selected.size === 1 &&
                workspace.can('asset:category')
              "
              native-type="button"
              :disabled="isBusy"
              @click="setCover"
            >
              <Image />{{ $t("设为封面") }}</el-button
            >
            <el-button
              type="danger"
              plain
              v-if="workspace.can('asset:delete')"
              native-type="button"
              :disabled="isBusy"
              @click="moveToTrash(selectedIds)"
            >
              <Trash2 />{{ $t("移入回收站") }}</el-button
            >
          </template>
        </template>
        <button
          type="button"
          class="ml-auto text-soft"
          :aria-label="$t('退出多选')"
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
        {{ $t("已加载") }}<span class="text-ghost">{{ items.length }}</span
        >{{
          $t("项结果 · 关键词匹配 · 本次查询 {value1} ms · 按上传时间倒序", {
            value1: tookMs ?? 0,
          })
        }}
      </p>
      <div
        v-if="loading"
        class="grid grid-cols-2 items-start gap-3 xl:grid-cols-3 2xl:grid-cols-4"
        :aria-label="$t('正在加载媒体')"
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
            ? $t('没有符合筛选条件的媒体')
            : (emptyTitle ?? $t('你的图库，等待第一张照片'))
        "
        :description="
          hasFilters
            ? $t('尝试更换筛选条件，或检查图片是否包含拍摄时间。')
            : (emptyDescription ??
              $t('上传照片，将重要的回忆与创作整理在同一个地方。'))
        "
        @retry="feed.reload"
      >
        <el-button
          v-if="hasFilters"
          native-type="button"
          @click="resetFilters"
          >{{ $t("清除筛选条件") }}</el-button
        >
        <el-button
          type="primary"
          v-else-if="
            !trash &&
            !query.tagId &&
            !query.placeId &&
            !query.favorite &&
            search === undefined &&
            uploads.canUpload(query.albumId)
          "
          native-type="button"
          @click="uploads.chooseFiles(query.albumId)"
        >
          <Upload />{{
            query.albumId ? $t("上传到相册") : $t("上传第一张照片")
          }}</el-button
        >
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
        <el-button
          :loading="loadingMore"
          v-if="hasMore"
          native-type="button"
          class="min-w-36"
          :disabled="loadingMore || isBusy"
          @click="feed.loadMore"
        >
          {{
            moreError
              ? $t("重试加载更多")
              : loadingMore
                ? $t("正在加载…")
                : $t("加载更多")
          }}</el-button
        ><span class="text-[11px] text-faint">{{
          $t("已显示 {value1} 项{value2} · 最新上传优先", {
            value1: items.length,
            value2: hasMore ? "" : $t(" · 已加载全部"),
          })
        }}</span>
      </div>
    </div>
    <RenameAssetDialog
      v-if="renamingAsset && !trash && workspace.can('asset:edit')"
      :key="renamingAsset.id"
      :asset="renamingAsset"
      @close="renamingAsset = null"
      @saved="exitSelection"
    />
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
