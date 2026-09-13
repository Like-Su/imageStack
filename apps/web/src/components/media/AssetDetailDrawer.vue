<script setup lang="ts">
import { translate } from "@/i18n";
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
  Maximize2,
  Pencil,
} from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { PERSON_TAG_PREFIX, processingLabels } from "@/config/workspace";
import { useRemoteData } from "@/composables/useRemoteData";
import { updateAssetDetail } from "@/composables/workspaceUpdates";
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
import ImageRecognitionPanel from "./ImageRecognitionPanel.vue";
import VideoSummaryPanel from "./VideoSummaryPanel.vue";
import ShareDialog from "./ShareDialog.vue";
import RenameAssetDialog from "./RenameAssetDialog.vue";

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
  { update: updateAssetDetail },
);
watch(asset, (value) => {
  if (value) workspace.rememberAssets([value]);
});
const { busy, downloading, download, moveToTrash, restore, purge } =
  useAssetActions(() => (asset.value ? [asset.value] : []));
const albumPicker = ref(false);
const tagPicker = ref(false);
const originalViewer = ref(false);
const sharing = ref(false);
const renaming = ref(false);
const tagBusy = ref(false);
const imageVersion = ref(0);

watch(assetId, () => {
  albumPicker.value = false;
  tagPicker.value = false;
  originalViewer.value = false;
  sharing.value = false;
  renaming.value = false;
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
  [translate("文件大小"), formatBytes(asset.value?.size)],
  [
    translate("媒体尺寸"),
    asset.value?.width && asset.value.height
      ? `${asset.value.width} × ${asset.value.height}`
      : "—",
  ],
  ...(asset.value?.type === "VIDEO"
    ? [[translate("视频时长"), formatDuration(asset.value.durationMs)]]
    : []),
  [translate("拍摄时间"), formatDate(asset.value?.takenAt, true)],
  [translate("上传时间"), formatDate(asset.value?.createdAt, true)],
  ...(asset.value?.type === "VIDEO"
    ? []
    : [
        [translate("相机品牌"), exifValue("Make")],
        [translate("相机型号"), exifValue("Model")],
        [translate("镜头"), exifValue("LensModel")],
        [translate("焦距 (mm)"), exifValue("FocalLength")],
        [translate("曝光时间 (s)"), exifValue("ExposureTime")],
        [translate("光圈"), exifValue("FNumber")],
        ["ISO", exifValue("ISO")],
      ]),
  [translate("文件格式"), asset.value?.mimeType ?? "—"],
]);

async function removeTag(tagId: string) {
  if (!asset.value || tagBusy.value) return;
  const id = asset.value.id;
  tagBusy.value = true;
  try {
    await workspace.perform(
      () => mediaApi.removeTag(id, tagId),
      translate("已移除此标签关联"),
      (result) => workspace.updateAssetTags(id, [result.tag], 0, tagId),
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
    :title="$t('媒体详情')"
    drawer
    :busy="busy || tagBusy"
    @update:open="workspace.selectedAsset = null"
  >
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
        /><el-button
          text
          circle
          native-type="button"
          class="absolute right-3 bottom-3 !bg-panel/80"
          :aria-label="$t('重新加载预览')"
          @click="reload"
        >
          <RefreshCw />
        </el-button>
      </div>
      <div class="space-y-6 p-5">
        <div>
          <el-button
            type="primary"
            v-if="!asset.deleted"
            class="mb-3 w-full"
            native-type="button"
            :disabled="!workspace.can('asset:download')"
            @click="originalViewer = true"
          >
            <Maximize2 />{{
              asset.type === "VIDEO" ? $t("查看原视频") : $t("查看原图片")
            }}
          </el-button>
          <div class="mb-4 flex items-center gap-2">
            <template v-if="!asset.deleted"
              ><el-button
                :loading="downloading"
                class="flex-1"
                native-type="button"
                :disabled="downloading || !workspace.can('asset:download')"
                @click="download(asset)"
              >
                <Download v-if="!downloading" />{{
                  asset.type === "VIDEO" ? $t("下载原视频") : $t("下载原图片")
                }}</el-button
              ><el-button
                text
                circle
                native-type="button"
                :class="{ '!text-accent': asset.isFavorite }"
                :aria-label="asset.isFavorite ? $t('取消收藏') : $t('收藏')"
                :aria-pressed="asset.isFavorite"
                :disabled="
                  workspace.favoriteBusy.has(asset.id) ||
                  !workspace.can('asset:edit')
                "
                @click="workspace.toggleFavorite(asset)"
              >
                <Star
                  :class="{ 'fill-current': asset.isFavorite }" /></el-button
              ><el-button
                text
                circle
                native-type="button"
                :disabled="
                  asset.type !== 'IMAGE' || !workspace.can('asset:share')
                "
                :title="
                  asset.type !== 'IMAGE'
                    ? $t('目前仅支持分享图片')
                    : $t('短链分享')
                "
                :aria-label="$t('短链分享')"
                @click="sharing = true"
              >
                <Share2 /></el-button
              ><el-button
                text
                circle
                class="!text-err"
                native-type="button"
                :aria-label="$t('移入回收站')"
                :disabled="busy || !workspace.can('asset:delete')"
                @click="moveToTrash([asset.id])"
              >
                <Trash2 /></el-button
            ></template>
            <template v-else
              ><el-button
                native-type="button"
                class="flex-1"
                :disabled="busy || !workspace.can('asset:delete')"
                @click="restore([asset.id])"
              >
                <RotateCcw />{{ $t("恢复到图库") }}</el-button
              ><el-button
                type="danger"
                plain
                native-type="button"
                :disabled="busy || !workspace.can('asset:delete')"
                @click="purge([asset.id])"
              >
                <Trash2 />{{ $t("永久删除") }}</el-button
              ></template
            >
          </div>
          <div class="flex items-start justify-between gap-2">
            <h3 class="min-w-0 break-words text-base font-semibold">
              {{ asset.name }}
            </h3>
            <el-button
              v-if="!asset.deleted && workspace.can('asset:edit')"
              native-type="button"
              size="small"
              class="shrink-0"
              :disabled="busy || tagBusy"
              @click="renaming = true"
            >
              <Pencil />{{ $t("重命名") }}
            </el-button>
          </div>
          <p v-if="asset.deleted" class="mt-2 text-xs text-warn">
            {{
              $t("已于 {value1} 移入回收站", {
                value1: formatDate(asset.deletedAt, true),
              })
            }}
          </p>
          <div class="mt-2 flex items-center gap-2">
            <span class="mh-badge" :class="`mh-status-${asset.status}`">{{
              $t(processingLabels[asset.status])
            }}</span
            ><span class="text-[10px] text-faint">{{
              asset.type === "VIDEO"
                ? $t("视频封面与兼容预览")
                : $t("缩略图与 EXIF")
            }}</span>
          </div>
          <p
            v-if="asset.processingError"
            class="mt-3 text-xs leading-6 text-err"
          >
            {{ asset.processingError }}
          </p>
        </div>
        <ImageRecognitionPanel
          v-if="asset.type === 'IMAGE' && !asset.deleted"
          :key="asset.id"
          :asset-id="asset.id"
          :ready="asset.status === 'READY'"
        />
        <VideoSummaryPanel
          v-else-if="asset.type === 'VIDEO' && !asset.deleted"
          :key="asset.id"
          :asset-id="asset.id"
        />
        <section v-else class="mh-gradient rounded-xl border border-ai/20 p-4">
          <h4 class="flex items-center gap-2 text-xs font-semibold text-ai">
            <Sparkles class="size-4" />{{ $t("AI 内容分析") }}
          </h4>
          <p class="mt-2 text-xs leading-6 text-soft">
            {{
              asset.deleted
                ? $t(
                    "回收站图片不会发送给 AI 服务，恢复后可查看或生成识图结果。",
                  )
                : $t("当前 AI 识图用于图片；视频仍通过文件名和手动标签检索。")
            }}
          </p>
        </section>
        <section>
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-xs font-medium">{{ $t("标签与人物") }}</h4>
            <button
              v-if="!asset.deleted && workspace.can('asset:tag')"
              type="button"
              class="flex items-center gap-1 text-xs text-accent"
              @click="tagPicker = true"
            >
              <Plus class="size-3.5" />{{ $t("添加") }}
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
                :aria-label="$t('移除标签 {value1}', { value1: tag.name })"
                :disabled="tagBusy"
                @click="removeTag(tag.id)"
              >
                <X class="size-3" /></button
            ></span>
          </div>
          <p v-else class="text-xs text-faint">
            {{ $t("暂无标签，添加后可更快找到此媒体。") }}
          </p>
        </section>
        <section>
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-xs font-medium">{{ $t("所属相册") }}</h4>
            <button
              v-if="!asset.deleted && workspace.can('asset:category')"
              type="button"
              class="flex items-center gap-1 text-xs text-accent"
              @click="albumPicker = true"
            >
              <FolderPlus class="size-3.5" />{{ $t("添加到相册") }}
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
          <p v-else class="text-xs text-faint">{{ $t("尚未加入相册") }}</p>
        </section>
        <section>
          <h4 class="mb-3 text-xs font-medium">
            {{
              asset.type === "VIDEO" ? $t("视频信息") : $t("文件信息 · EXIF")
            }}
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
            {{ $t("内容校验 · {value1}", { value1: asset.hashAlgorithm }) }}
          </summary>
          <p class="mt-2 break-all font-mono text-[10px] leading-5 text-soft">
            {{ asset.hash }}
          </p>
        </details>
      </div>
    </template>
  </AppModal>
  <RenameAssetDialog
    v-if="renaming && asset && !asset.deleted && workspace.can('asset:edit')"
    :key="asset.id"
    :asset="asset"
    @close="renaming = false"
  />
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
  <ShareDialog
    v-if="sharing && asset && !asset.deleted"
    :key="asset.id"
    :target="{ kind: 'asset', targetId: asset.id }"
    :name="asset.name"
    @close="sharing = false"
  />
</template>
