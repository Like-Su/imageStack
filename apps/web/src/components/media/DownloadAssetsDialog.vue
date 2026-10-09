<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, FileArchive, Files, LoaderCircle } from "lucide-vue-next";
import { formatBytes } from "@/composables/mediaFormat";
import { useAssetActions } from "@/composables/useAssetActions";
import type { AssetSummary, DownloadMode } from "@/types/media";
import AppModal from "@/components/workspace/AppModal.vue";

const props = defineProps<{ assets: AssetSummary[] }>();
const emit = defineEmits<{ close: [] }>();
const remaining = ref([...props.assets]);
const totalBytes = computed(() =>
  remaining.value.reduce((sum, asset) => sum + Number(asset.size ?? 0), 0),
);
const {
  downloading,
  downloadProgress,
  downloadError,
  downloadMany,
  cancelDownload,
} = useAssetActions();
const activeMode = ref<DownloadMode>("archive");

async function start(mode: DownloadMode) {
  if (downloading.value) return;
  activeMode.value = mode;
  remaining.value = await downloadMany([...remaining.value], mode);
  if (!remaining.value.length) emit("close");
}
</script>

<template>
  <AppModal
    open
    :title="$t('选择下载方式')"
    :busy="downloading"
    @update:open="emit('close')"
  >
    <div class="space-y-4 p-5">
      <p class="text-sm text-soft">
        {{
          $t("{value1} 个文件 · 合计 {value2}", {
            value1: remaining.length,
            value2: formatBytes(totalBytes),
          })
        }}
      </p>
      <div class="grid gap-3">
        <button
          type="button"
          class="flex items-center gap-4 rounded-xl border border-accent/40 bg-accent/5 p-4 text-left transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="downloading"
          @click="start('archive')"
        >
          <FileArchive class="size-7 shrink-0 text-accent" />
          <span>
            <span class="block text-sm font-medium">{{
              $t("打包下载 ZIP")
            }}</span>
            <span class="mt-1 block text-xs leading-5 text-soft">{{
              $t("生成一个 ZIP 压缩包，同名文件自动编号，不覆盖原文件。")
            }}</span>
          </span>
        </button>
        <button
          type="button"
          class="flex items-center gap-4 rounded-xl border border-line bg-panel2 p-4 text-left transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="downloading"
          @click="start('individual')"
        >
          <Files class="size-7 shrink-0 text-soft" />
          <span>
            <span class="block text-sm font-medium">{{ $t("单独下载") }}</span>
            <span class="mt-1 block text-xs leading-5 text-soft">{{
              $t("逐个下载原文件，保留各自的文件名和格式。")
            }}</span>
          </span>
        </button>
      </div>
      <p class="text-xs leading-5 text-faint">
        {{
          $t(
            "单独下载时，浏览器可能询问是否允许下载多个文件，请选择允许。下载进度以浏览器下载列表为准。",
          )
        }}
      </p>
      <p
        v-if="downloading"
        class="flex items-center gap-2 text-xs text-accent"
        role="status"
      >
        <LoaderCircle class="size-4 animate-spin" />
        {{
          activeMode === "archive"
            ? $t("正在准备 ZIP 下载…")
            : $t("正在发起下载 {value1} / {value2}", {
                value1: downloadProgress.started,
                value2: downloadProgress.total,
              })
        }}
      </p>
      <p v-if="downloadError" class="text-xs leading-6 text-err" role="alert">
        {{ downloadError }}
      </p>
      <div class="flex justify-end">
        <el-button
          native-type="button"
          @click="downloading ? cancelDownload() : emit('close')"
        >
          <Download v-if="downloading" />{{
            downloading ? $t("停止发起下载") : $t("关闭")
          }}
        </el-button>
      </div>
    </div>
  </AppModal>
</template>
