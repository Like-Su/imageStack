<script setup lang="ts">
import { computed, onDeactivated, onScopeDispose, ref, watch } from "vue";
import { FolderMinus, Image, Pencil, RefreshCw, X } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage, requestScope } from "@/api/request";
import { useAssetFeed } from "@/composables/useAssetFeed";
import { useRemoteData } from "@/composables/useRemoteData";
import { updateAssetDetail } from "@/composables/workspaceUpdates";
import { translate } from "@/i18n";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Album, AssetDetail, AssetSummary } from "@/types/media";
import AppModal from "@/components/workspace/AppModal.vue";
import DataState from "@/components/workspace/DataState.vue";
import AssetGrid from "./AssetGrid.vue";
import AssetLoadMore from "./AssetLoadMore.vue";
import AssetSortControl from "./AssetSortControl.vue";
import OriginalMediaViewer from "./OriginalMediaViewer.vue";
import RenameAssetDialog from "./RenameAssetDialog.vue";

const props = defineProps<{
  album: Album & {
    permissions: {
      edit: boolean;
      removeAssets: boolean;
    };
  };
}>();
const emit = defineEmits<{ refresh: [] }>();
const workspace = useWorkspaceStore();
const mediaType = ref<"all" | "image" | "video">("all");
const feed = useAssetFeed(() => ({
  query: {
    albumId: props.album.id,
    ...(mediaType.value === "all" ? {} : { type: mediaType.value }),
  },
}));
const { items, loading, loadingMore, refreshing, error, moreError, hasMore } =
  feed;
const selected = ref(new Set<string>());
const selectedIds = computed(() => [...selected.value]);
const single = computed(() =>
  selected.value.size === 1
    ? items.value.find((asset) => asset.id === selectedIds.value[0])
    : undefined,
);
const canEdit = computed(() => props.album.permissions.edit);
const canRename = computed(() => props.album.permissions.edit);
const canRemove = computed(() => props.album.permissions.removeAssets);
const canSelect = computed(
  () => canEdit.value || canRename.value || canRemove.value,
);
const busy = ref(false);
const actionError = ref("");
const renaming = ref<AssetSummary | null>(null);
const openedId = ref<string | null>(null);
const {
  data: openedAsset,
  loading: opening,
  error: openError,
  refresh: reloadAsset,
} = useRemoteData<AssetDetail | null>(
  (signal) =>
    openedId.value
      ? mediaApi.detail(openedId.value, signal)
      : Promise.resolve(null),
  [openedId],
  { resources: ["assets"], update: updateAssetDetail },
);
const controller = new AbortController();
const scope = requestScope();
onScopeDispose(() => controller.abort());
onDeactivated(() => {
  openedId.value = null;
  renaming.value = null;
});

function isCurrent() {
  return !controller.signal.aborted && scope === requestScope();
}

watch(items, (assets) => {
  const ids = new Set(assets.map((asset) => asset.id));
  selected.value = new Set(
    selectedIds.value.filter((assetId) => ids.has(assetId)),
  );
});
watch(canSelect, (allowed) => {
  if (!allowed) selected.value = new Set();
});
watch(canRename, (allowed) => {
  if (!allowed) renaming.value = null;
});

function toggle(assetId: string) {
  if (busy.value || !canSelect.value) return;
  const next = new Set(selected.value);
  if (next.has(assetId)) next.delete(assetId);
  else if (next.size < 100) next.add(assetId);
  else {
    workspace.notify(
      translate("一次最多选择 100 项媒体，请分批操作。"),
      "info",
    );
    return;
  }
  selected.value = next;
}

function open(asset: AssetSummary) {
  if (busy.value) return;
  workspace.rememberAssets([asset], props.album.id);
  openedId.value = asset.id;
}

function reload() {
  actionError.value = "";
  emit("refresh");
  void feed.reload();
}

async function setCover() {
  const asset = single.value;
  if (!asset || !canEdit.value || busy.value || !isCurrent()) return;
  busy.value = true;
  actionError.value = "";
  try {
    const album = await mediaApi.updateAlbum(props.album.id, {
      coverAssetId: asset.id,
    });
    if (!isCurrent()) return;
    workspace.updateAlbum(album);
    workspace.notify(translate("相册封面已更新"));
  } catch (cause) {
    if (isCurrent()) actionError.value = getErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}

async function removeSelected() {
  if (!selected.value.size || !canRemove.value || busy.value || !isCurrent())
    return;
  const ids = selectedIds.value;
  busy.value = true;
  actionError.value = "";
  try {
    if (
      !(await workspace.confirm({
        title: translate("从共享相册移除媒体？"),
        message: translate(
          "将移除所选 {value1} 项关联，上传者的原文件和其他相册不受影响。",
          { value1: ids.length },
        ),
        confirmLabel: translate("移除媒体"),
        danger: true,
      })) ||
      !isCurrent()
    )
      return;
    workspace.rememberAssets(
      items.value.filter((asset) => ids.includes(asset.id)),
      props.album.id,
    );
    const result = await mediaApi.removeFromAlbum(props.album.id, ids);
    if (!isCurrent()) return;
    workspace.updateAlbumMembers(result.album, ids, false);
    selected.value = new Set();
    workspace.notify(
      translate("已从相册移除 {value1} 项媒体", { value1: result.count }),
    );
  } catch (cause) {
    if (isCurrent()) actionError.value = getErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="space-y-4 px-4 pb-6 sm:px-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <el-radio-group
        v-model="mediaType"
        :disabled="busy"
        :aria-label="$t('媒体类型')"
      >
        <el-radio-button value="all">{{ $t("全部") }}</el-radio-button>
        <el-radio-button value="image">{{ $t("图片") }}</el-radio-button>
        <el-radio-button value="video">{{ $t("视频") }}</el-radio-button>
      </el-radio-group>
      <AssetSortControl :disabled="busy" />
      <el-button
        native-type="button"
        :disabled="loading || busy"
        @click="reload"
        ><RefreshCw :class="{ 'animate-spin': loading }" />{{
          $t("刷新共享相册")
        }}</el-button
      >
    </div>
    <p class="text-xs leading-6 text-soft">
      {{ $t("共享相册只在授权范围内协作，移除媒体不会删除上传者的原文件。") }}
    </p>
    <div
      v-if="canSelect && items.length"
      class="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel2 p-3"
    >
      <span class="mr-auto text-xs text-soft">{{
        $t("已选择 {value1} 项", { value1: selected.size })
      }}</span>
      <el-button
        v-if="canRename"
        native-type="button"
        :disabled="!single || busy"
        @click="renaming = single ?? null"
        ><Pencil />{{ $t("重命名文件") }}</el-button
      >
      <el-button
        v-if="canEdit"
        native-type="button"
        :disabled="!single || busy"
        @click="setCover"
        ><Image />{{ $t("设为封面") }}</el-button
      >
      <el-button
        v-if="canRemove"
        native-type="button"
        type="danger"
        plain
        :disabled="!selected.size || busy"
        @click="removeSelected"
        ><FolderMinus />{{ $t("移除媒体") }}</el-button
      >
      <el-button
        v-if="selected.size"
        text
        circle
        native-type="button"
        :disabled="busy"
        :aria-label="$t('取消选择')"
        @click="selected = new Set()"
        ><X
      /></el-button>
    </div>
    <p v-if="actionError" class="text-xs text-err" role="alert">
      {{ actionError }}
    </p>
    <DataState
      v-if="loading || error || !items.length"
      :loading="loading"
      :error="error"
      :title="$t('这个相册还没有照片')"
      :description="$t('有添加权限的成员可以上传媒体或从自己的图库添加。')"
      @retry="reload"
    />
    <AssetGrid
      v-else
      :items="items"
      :selected="selected"
      :selecting="selected.size > 0"
      :selectable="canSelect && !busy"
      :favorites="false"
      @select="toggle"
      @open="open"
    />
    <AssetLoadMore
      v-if="items.length"
      :count="items.length"
      :has-more="hasMore"
      :loading="loadingMore || refreshing"
      :disabled="busy"
      :error="moreError"
      @load="feed.loadMore"
    />
    <RenameAssetDialog
      v-if="renaming && canRename"
      :key="renaming.id"
      :asset="renaming"
      :album-id="album.id"
      @close="renaming = null"
    />
    <OriginalMediaViewer
      v-if="openedId && openedAsset"
      :key="openedAsset.id"
      :asset="openedAsset"
      shared
      @close="openedId = null"
    />
    <AppModal
      v-else-if="openedId"
      open
      :title="$t('查看媒体')"
      @update:open="openedId = null"
    >
      <DataState :loading="opening" :error="openError" @retry="reloadAsset" />
    </AppModal>
  </div>
</template>
