<script setup lang="ts">
import { translate } from "@/i18n";
import { computed, ref } from "vue";
import { FolderOpen, Upload } from "lucide-vue-next";
import type { UploadFile, UploadInstance } from "element-plus";

import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { prepareAlbumCover } from "@/composables/albumCover";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Album } from "@/types/media";
import AppModal from "@/components/workspace/AppModal.vue";
import AssetImage from "./AssetImage.vue";
import LoadingImage from "./LoadingImage.vue";
import AssetPicker from "./AssetPicker.vue";

const props = defineProps<{ album?: Album }>();
const emit = defineEmits<{ close: []; saved: [album: Album] }>();
const workspace = useWorkspaceStore();
const name = ref(props.album?.name ?? "");
const description = ref(props.album?.description ?? "");
const initialCoverSource = props.album?.coverSource ?? "auto";
const initialCoverImage =
  initialCoverSource === "custom" ? (props.album?.coverUrl ?? null) : null;
const initialCoverAssetId = props.album?.coverAssetId ?? null;
const coverSource = ref<Album["coverSource"]>(initialCoverSource);
const coverImage = ref(initialCoverImage);
const coverAssetId = ref(initialCoverAssetId);
const coverRevision = ref(props.album?.coverThumbnailRevision ?? undefined);
const upload = ref<UploadInstance>();
const picking = ref(false);
const saving = ref(false);
const preparing = ref(false);
const busy = computed(() => saving.value || preparing.value);
const coverChanged = computed(
  () =>
    coverSource.value !== initialCoverSource ||
    (coverSource.value === "custom" &&
      coverImage.value !== initialCoverImage) ||
    (coverSource.value === "asset" &&
      coverAssetId.value !== initialCoverAssetId),
);
const previewAssetId = computed(() =>
  coverSource.value === "asset"
    ? coverAssetId.value
    : coverSource.value === "auto" && initialCoverSource === "auto"
      ? initialCoverAssetId
      : null,
);
const error = ref("");

async function chooseImage(file: UploadFile) {
  if (!file.raw || busy.value) return;
  preparing.value = true;
  error.value = "";
  try {
    coverImage.value = await prepareAlbumCover(file.raw);
  } catch (cause) {
    error.value = getErrorMessage(cause);
  } finally {
    preparing.value = false;
    upload.value?.clearFiles();
  }
}

function chooseAsset(ids: string[]) {
  const selectedId = ids[0];
  if (!selectedId || busy.value) return;
  coverAssetId.value = selectedId;
  coverRevision.value =
    workspace.knownAssets([selectedId])[0]?.thumbnailRevision ?? undefined;
  coverSource.value = "asset";
  error.value = "";
  picking.value = false;
}

async function submit() {
  if (busy.value || picking.value) return;
  if (!name.value.trim()) {
    error.value = translate("请输入相册名称");
    return;
  }
  if (coverSource.value === "custom" && !coverImage.value) {
    error.value = translate("请选择自定义封面图片");
    return;
  }
  if (coverSource.value === "asset" && (!props.album || !coverAssetId.value)) {
    error.value = translate("请选择相册内的封面资源");
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    const body = {
      name: name.value.trim(),
      description: description.value.trim(),
    };
    const album = props.album
      ? await mediaApi.updateAlbum(props.album.id, {
          ...body,
          ...(coverChanged.value
            ? {
                coverAssetId:
                  coverSource.value === "asset" ? coverAssetId.value : null,
                coverImage:
                  coverSource.value === "custom" ? coverImage.value : null,
              }
            : {}),
        })
      : await mediaApi.createAlbum({
          ...body,
          ...(coverSource.value === "custom"
            ? { coverImage: coverImage.value }
            : {}),
        });
    workspace.updateAlbum(album, !props.album);
    workspace.notify(
      props.album
        ? translate("相册已更新")
        : translate("相册已创建，可以添加照片了"),
    );
    emit("saved", album);
    emit("close");
  } catch (cause) {
    error.value = getErrorMessage(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AppModal
    open
    :title="album ? $t('编辑相册') : $t('新建相册')"
    :description="$t('给回忆一个名字，让每一张照片都有归属。')"
    :busy="busy || picking"
    @update:open="emit('close')"
  >
    <form class="space-y-4 p-5" @submit.prevent="submit">
      <label class="mh-label"
        >{{ $t("相册名称")
        }}<el-input
          v-model="name"
          maxlength="200"
          required
          autofocus
          :disabled="busy"
          :placeholder="$t('例如：夏日旅行')"
      /></label>
      <label class="mh-label"
        >{{ $t("描述（可选）")
        }}<el-input
          type="textarea"
          :rows="4"
          v-model="description"
          maxlength="2000"
          :disabled="busy"
          :placeholder="$t('记录一些与这段回忆有关的事…')"
        />
      </label>
      <div class="space-y-3">
        <span class="mh-label">{{ $t("相册封面") }}</span>
        <el-radio-group
          v-model="coverSource"
          :disabled="busy"
          :aria-label="$t('相册封面')"
          size="small"
          @change="error = ''"
        >
          <el-radio-button value="auto">{{ $t("自动封面") }}</el-radio-button>
          <el-radio-button value="custom">{{
            $t("自定义图片")
          }}</el-radio-button>
          <el-radio-button value="asset" :disabled="!album?.count">{{
            $t("相册内资源")
          }}</el-radio-button>
        </el-radio-group>
        <div class="flex flex-col items-start gap-3 sm:flex-row">
          <div
            class="relative aspect-[4/3] w-36 shrink-0 overflow-hidden rounded-lg border border-line bg-panel2"
          >
            <LoadingImage
              v-if="coverSource === 'custom' && coverImage"
              :src="coverImage"
              :alt="$t('相册封面')"
            />
            <AssetImage
              v-else-if="previewAssetId"
              :asset-id="previewAssetId"
              :name="$t('相册封面')"
              :version="
                coverSource === 'asset'
                  ? coverRevision
                  : (album?.coverThumbnailRevision ?? undefined)
              "
            />
            <div
              v-else
              class="mh-gradient absolute inset-0 grid place-items-center"
            >
              <FolderOpen class="size-8 text-ai/40" />
            </div>
          </div>
          <div class="min-w-0 space-y-2">
            <template v-if="coverSource === 'custom'">
              <el-upload
                ref="upload"
                accept="image/png,image/jpeg,image/webp"
                :auto-upload="false"
                :show-file-list="false"
                :disabled="busy"
                :on-change="chooseImage"
              >
                <el-button
                  native-type="button"
                  :icon="Upload"
                  :disabled="busy"
                  :loading="preparing"
                  >{{ $t("上传封面图片") }}</el-button
                >
              </el-upload>
              <p class="text-xs leading-5 text-soft">
                {{
                  $t(
                    "支持 PNG、JPEG、WebP，不超过 5 MiB；自动裁剪为 4:3，仅用作封面，不加入图库。",
                  )
                }}
              </p>
            </template>
            <template v-else-if="coverSource === 'asset'">
              <el-button
                native-type="button"
                :icon="FolderOpen"
                :disabled="busy"
                @click="picking = true"
                >{{ $t("选择相册内资源") }}</el-button
              >
              <p class="text-xs leading-5 text-soft">
                {{ $t("可选择相册内的图片或视频，视频将使用缩略图。") }}
              </p>
            </template>
            <p v-else class="text-xs leading-5 text-soft">
              {{ $t("自动使用相册内最新资源作为封面。") }}
            </p>
          </div>
        </div>
        <p v-if="!album?.count" class="text-xs leading-5 text-soft">
          {{ $t("添加资源后，可选择相册内资源作为封面。") }}
        </p>
      </div>
      <p v-if="error" class="text-xs text-err" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <el-button
          native-type="button"
          :disabled="busy"
          @click="emit('close')"
          >{{ $t("取消") }}</el-button
        ><el-button
          type="primary"
          :loading="busy"
          native-type="submit"
          :disabled="busy"
        >
          {{ album ? $t("保存更改") : $t("创建相册") }}
        </el-button>
      </div>
    </form>
  </AppModal>
  <AssetPicker
    v-if="picking && album"
    :title="$t('选择相册封面')"
    :album-id="album.id"
    :multiple="false"
    :initial-selection="coverAssetId ? [coverAssetId] : []"
    @close="picking = false"
    @submit="chooseAsset"
  />
</template>
