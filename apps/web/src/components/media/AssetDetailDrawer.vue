<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import {
  Download,
  Star,
  Trash2,
  RotateCcw,
  Share2,
  Sparkles,
  Plus,
  X,
  MapPin,
  FolderPlus,
  RefreshCw,
  LoaderCircle,
  Maximize2,
} from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { PERSON_TAG_PREFIX, processingLabels } from "@/config/workspace";
import { useRemoteData } from "@/composables/useRemoteData";
import { useAssetActions } from "@/composables/useAssetActions";
import {
  formatBytes,
  formatCoordinate,
  formatDate,
  formatDuration,
} from "@/composables/mediaFormat";
import { useWorkspaceStore } from "@/stores/workspace";
import type { AssetDetail } from "@/types/media";
import AppModal from "@/components/workspace/AppModal.vue";
import DataState from "@/components/workspace/DataState.vue";
import AssetImage from "./AssetImage.vue";
import AlbumPicker from "./AlbumPicker.vue";
import TagAssignmentDialog from "./TagAssignmentDialog.vue";
import OriginalMediaViewer from "./OriginalMediaViewer.vue";

const workspace = useWorkspaceStore();
const assetId = computed(() => workspace.selectedAsset?.id ?? "");
const {
  data: asset,
  loading,
  error,
  refresh,
} = useRemoteData<AssetDetail | null>(
  (signal) =>
    workspace.selectedAsset
      ? mediaApi.detail(
          workspace.selectedAsset.id,
          signal,
          workspace.selectedAsset.deleted,
        )
      : Promise.resolve(null),
  [assetId],
);
const { busy, downloading, download, moveToTrash, restore, purge } =
  useAssetActions();
const albumPicker = ref(false);
const tagPicker = ref(false);
const originalViewer = ref(false);
const tagBusy = ref(false);
const imageVersion = ref(0);
const noticeStart = ref(0);
const feedback = computed(() =>
  workspace.notices.filter((notice) => notice.id > noticeStart.value).slice(-1),
);

watch(assetId, () => {
  albumPicker.value = false;
  tagPicker.value = false;
  originalViewer.value = false;
  noticeStart.value = workspace.notices.at(-1)?.id ?? 0;
});

function exifValue(key: string) {
  const value = asset.value?.exif?.[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "—";
}
const location = computed(() => {
  const latitude = asset.value?.exif?.latitude;
  const longitude = asset.value?.exif?.longitude;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  return {
    label: formatCoordinate(latitude, longitude),
    id: `${Math.floor(latitude * 10)}:${Math.floor(longitude * 10)}`,
  };
});
const metadata = computed(() => [
  ["文件大小", formatBytes(asset.value?.size)],
  [
    "媒体尺寸",
    asset.value?.width && asset.value.height
      ? `${asset.value.width} × ${asset.value.height}`
      : "—",
  ],
  ...(asset.value?.type === "VIDEO"
    ? [["视频时长", formatDuration(asset.value.durationMs)]]
    : []),
  ["拍摄时间", formatDate(asset.value?.takenAt, true)],
  ["上传时间", formatDate(asset.value?.createdAt, true)],
  ...(asset.value?.type === "VIDEO"
    ? []
    : [
        ["相机品牌", exifValue("Make")],
        ["相机型号", exifValue("Model")],
        ["镜头", exifValue("LensModel")],
        ["焦距 (mm)", exifValue("FocalLength")],
        ["曝光时间 (s)", exifValue("ExposureTime")],
        ["光圈", exifValue("FNumber")],
        ["ISO", exifValue("ISO")],
      ]),
  ["文件格式", asset.value?.mimeType ?? "—"],
]);

async function removeTag(tagId: string) {
  if (!asset.value || tagBusy.value) return;
  const id = asset.value.id;
  tagBusy.value = true;
  try {
    await workspace.perform(
      () => mediaApi.removeTag(id, tagId),
      "已移除此标签关联",
    );
  } finally {
    tagBusy.value = false;
  }
}
function reload() {
  imageVersion.value += 1;
  void refresh();
}
</script>

<template>
  <AppModal
    :open="Boolean(workspace.selectedAsset)"
    title="媒体详情"
    drawer
    :busy="busy || tagBusy"
    @update:open="workspace.selectedAsset = null"
  >
    <p
      v-for="notice in feedback"
      :key="notice.id"
      class="mx-5 mt-4 rounded-lg border border-line bg-panel2 p-3 text-xs leading-5"
      :class="notice.kind === 'error' ? 'text-err' : 'text-ok'"
    >
      {{ notice.message }}
    </p>
    <DataState
      v-if="loading || error"
      :loading="loading"
      :error="error"
      @retry="reload"
    />
    <template v-else-if="asset">
      <div class="relative aspect-[4/3] bg-ink">
        <AssetImage
          :asset-id="asset.id"
          :name="asset.name"
          :trash="asset.deleted"
          :version="`${asset.status}-${imageVersion}`"
          contain
        /><button
          type="button"
          class="mh-icon-button absolute right-3 bottom-3 !bg-panel/80"
          aria-label="重新加载预览"
          @click="reload"
        >
          <RefreshCw />
        </button>
      </div>
      <div class="space-y-6 p-5">
        <div>
          <button
            v-if="!asset.deleted"
            class="mh-button mh-button-primary mb-3 w-full"
            type="button"
            :disabled="!workspace.can('asset:download')"
            @click="originalViewer = true"
          >
            <Maximize2 />{{
              asset.type === "VIDEO" ? "查看原视频" : "查看原图片"
            }}
          </button>
          <div class="mb-4 flex items-center gap-2">
            <template v-if="!asset.deleted"
              ><button
                class="mh-button flex-1"
                type="button"
                :disabled="downloading || !workspace.can('asset:download')"
                @click="download(asset)"
              >
                <LoaderCircle
                  v-if="downloading"
                  class="animate-spin"
                /><Download v-else />{{
                  asset.type === "VIDEO" ? "下载原视频" : "下载原图片"
                }}</button
              ><button
                class="mh-icon-button"
                type="button"
                :class="{ '!text-accent': asset.isFavorite }"
                :aria-label="asset.isFavorite ? '取消收藏' : '收藏'"
                :aria-pressed="asset.isFavorite"
                :disabled="
                  workspace.favoriteBusy.has(asset.id) ||
                  !workspace.can('asset:edit')
                "
                @click="workspace.toggleFavorite(asset)"
              >
                <Star :class="{ 'fill-current': asset.isFavorite }" /></button
              ><button
                class="mh-icon-button"
                type="button"
                disabled
                title="分享接口尚未接入"
                aria-label="分享功能尚未接入"
              >
                <Share2 /></button
              ><button
                class="mh-icon-button !text-err"
                type="button"
                aria-label="移入回收站"
                :disabled="busy || !workspace.can('asset:delete')"
                @click="moveToTrash([asset.id])"
              >
                <Trash2 /></button
            ></template>
            <template v-else
              ><button
                type="button"
                class="mh-button flex-1"
                :disabled="busy || !workspace.can('asset:delete')"
                @click="restore([asset.id])"
              >
                <RotateCcw />恢复到图库</button
              ><button
                type="button"
                class="mh-button mh-button-danger"
                :disabled="busy || !workspace.can('asset:delete')"
                @click="purge([asset.id])"
              >
                <Trash2 />永久删除
              </button></template
            >
          </div>
          <h3 class="break-words text-base font-semibold">{{ asset.name }}</h3>
          <p v-if="asset.deleted" class="mt-2 text-xs text-warn">
            已于 {{ formatDate(asset.deletedAt, true) }} 移入回收站
          </p>
          <div class="mt-2 flex items-center gap-2">
            <span class="mh-badge" :class="`mh-status-${asset.status}`">{{
              processingLabels[asset.status]
            }}</span
            ><span class="text-[10px] text-faint">{{
              asset.type === "VIDEO" ? "视频封面与兼容预览" : "缩略图与 EXIF"
            }}</span>
          </div>
          <p
            v-if="asset.processingError"
            class="mt-3 text-xs leading-6 text-err"
          >
            {{ asset.processingError }}
          </p>
        </div>
        <section class="mh-gradient rounded-xl border border-ai/20 p-4">
          <h4 class="flex items-center gap-2 text-xs font-semibold text-ai">
            <Sparkles class="size-4" />AI 内容分析
          </h4>
          <p class="mt-2 text-xs leading-6 text-soft">
            描述、物体识别与向量模型尚未接入。当前可通过文件名、手动标签和人物归类检索媒体。
          </p>
        </section>
        <section>
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-xs font-medium">标签与人物</h4>
            <button
              v-if="!asset.deleted && workspace.can('asset:tag')"
              type="button"
              class="flex items-center gap-1 text-xs text-accent"
              @click="tagPicker = true"
            >
              <Plus class="size-3.5" />添加
            </button>
          </div>
          <div v-if="asset.tags.length" class="flex flex-wrap gap-2">
            <span
              v-for="tag in asset.tags"
              :key="tag.id"
              class="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-panel2 px-2 py-1 text-[11px] text-soft"
              ><RouterLink
                :to="{
                  name: tag.name.startsWith(PERSON_TAG_PREFIX)
                    ? 'person-detail'
                    : 'tag-detail',
                  params: { id: tag.id },
                }"
                class="truncate hover:text-accent"
                ># {{ tag.name }}</RouterLink
              ><button
                v-if="!asset.deleted && workspace.can('asset:tag')"
                type="button"
                class="text-faint hover:text-err"
                :aria-label="`移除标签 ${tag.name}`"
                :disabled="tagBusy"
                @click="removeTag(tag.id)"
              >
                <X class="size-3" /></button
            ></span>
          </div>
          <p v-else class="text-xs text-faint">
            暂无标签，添加后可更快找到此媒体。
          </p>
        </section>
        <section>
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-xs font-medium">所属相册</h4>
            <button
              v-if="!asset.deleted && workspace.can('asset:category')"
              type="button"
              class="flex items-center gap-1 text-xs text-accent"
              @click="albumPicker = true"
            >
              <FolderPlus class="size-3.5" />添加到相册
            </button>
          </div>
          <div v-if="asset.albums.length" class="flex flex-wrap gap-2">
            <RouterLink
              v-for="album in asset.albums"
              :key="album.id"
              :to="{ name: 'album-detail', params: { id: album.id } }"
              class="mh-chip"
              >{{ album.name }}</RouterLink
            >
          </div>
          <p v-else class="text-xs text-faint">尚未加入相册</p>
        </section>
        <section>
          <h4 class="mb-3 text-xs font-medium">
            {{ asset.type === "VIDEO" ? "视频信息" : "文件信息 · EXIF" }}
          </h4>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-4">
            <div v-for="[label, value] in metadata" :key="label">
              <dt class="text-[10px] text-faint">{{ label }}</dt>
              <dd class="mt-1 break-words text-xs text-soft">{{ value }}</dd>
            </div>
          </dl>
        </section>
        <RouterLink
          v-if="location && !asset.deleted"
          :to="{ name: 'places', query: { place: location.id } }"
          class="flex items-center gap-2 rounded-xl border border-line bg-panel2 p-3 text-xs text-ai"
          ><MapPin class="size-4" />{{ location.label }}</RouterLink
        >
        <details v-if="asset.hash" class="border-t border-line pt-4">
          <summary class="text-[11px] text-faint">
            内容校验 · {{ asset.hashAlgorithm }}
          </summary>
          <p class="mt-2 break-all font-mono text-[10px] leading-5 text-soft">
            {{ asset.hash }}
          </p>
        </details>
      </div>
    </template>
  </AppModal>
  <OriginalMediaViewer
    v-if="originalViewer && asset && !asset.deleted"
    :asset="asset"
    @close="originalViewer = false"
  />
  <AlbumPicker
    v-if="albumPicker && asset"
    :asset-ids="[asset.id]"
    @close="albumPicker = false"
  />
  <TagAssignmentDialog
    v-if="tagPicker && asset"
    :asset-ids="[asset.id]"
    @close="tagPicker = false"
  />
</template>
