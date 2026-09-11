<script setup lang="ts">
import { translate } from "@/i18n";
import { onScopeDispose, ref, watch } from "vue";
import { RefreshCw, Sparkles } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useRemoteData } from "@/composables/useRemoteData";
import { useWorkspaceStore } from "@/stores/workspace";
import type { ImageRecognition } from "@/types/media";

const props = defineProps<{ assetId: string; ready: boolean }>();
const workspace = useWorkspaceStore();
const {
  data: result,
  error,
  loading,
  refresh,
} = useRemoteData<ImageRecognition | null>(
  (signal) => mediaApi.recognition(props.assetId, signal),
  [() => props.assetId, () => props.ready],
);
const busy = ref(false);
let timer: number | undefined;
watch(result, (value, previous) => {
  window.clearTimeout(timer);
  if (value && ["PENDING", "PROCESSING"].includes(value.status))
    timer = window.setTimeout(() => {
      void refresh();
    }, 5000);
  if (value?.status === "READY" && previous && previous.status !== "READY")
    workspace.invalidate();
});
onScopeDispose(() => window.clearTimeout(timer));

async function recognize() {
  if (busy.value || !props.ready || !workspace.can("asset:edit")) return;
  busy.value = true;
  const assetId = props.assetId;
  try {
    if (
      !(await workspace.confirm({
        title: translate("识别图片内容？"),
        message: translate(
          "将压缩图片发送到已配置的 AI 服务，生成画面描述、关键词和文字索引，可能产生调用费用。",
        ),
        confirmLabel: translate("开始识图"),
      }))
    )
      return;
    if (assetId !== props.assetId) return;
    await mediaApi.indexImages([assetId]);
    await refresh();
  } catch (failure) {
    workspace.notify(getErrorMessage(failure), "error");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="mh-gradient rounded-xl border border-ai/20 p-4">
    <div class="flex items-center justify-between gap-2">
      <h4 class="flex items-center gap-2 text-xs font-semibold text-ai">
        <Sparkles class="size-4" />{{ $t("AI 内容分析") }}
      </h4>
      <el-button
        text
        circle
        native-type="button"
        :disabled="loading"
        :aria-label="$t('刷新图片识别结果')"
        @click="refresh()"
      >
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </el-button>
    </div>
    <p v-if="error" class="mt-2 text-xs leading-6 text-err">{{ error }}</p>
    <template v-else-if="result?.status === 'READY'">
      <p
        class="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-soft"
      >
        {{ result.description }}
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="keyword in result.keywords"
          :key="keyword"
          class="mh-chip break-all"
          >{{ keyword }}</span
        >
      </div>
      <details v-if="result.ocrText" class="mt-3 text-xs text-soft">
        <summary class="cursor-pointer text-ai">
          {{ $t("查看识别文字") }}
        </summary>
        <p
          class="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words leading-6"
        >
          {{ result.ocrText }}
        </p>
      </details>
      <p class="mt-3 break-words text-[10px] leading-5 text-faint">
        {{
          $t(
            "模型：{value1}。AI 结果可能存在误识别，仅作检索参考；动画只识别首帧。",
            { value1: result.model },
          )
        }}
      </p>
    </template>
    <template v-else>
      <p class="mt-2 text-xs leading-6 text-soft" aria-live="polite">
        {{
          result?.status === "PROCESSING"
            ? $t("正在识别图片内容…")
            : result?.status === "PENDING"
              ? $t("已进入识图队列，等待后台处理…")
              : result?.status === "FAILED"
                ? $t("图片识别失败，可检查配置后重试。")
                : $t(
                    "尚未生成内容索引，识图完成后可通过画面描述、关键词和文字搜索。",
                  )
        }}
      </p>
      <p v-if="result?.error" class="mt-2 text-xs leading-6 text-warn">
        {{ result.error }}
      </p>
      <el-button
        :loading="busy"
        v-if="
          (!result || result.status === 'FAILED') && workspace.can('asset:edit')
        "
        class="mt-3"
        native-type="button"
        :disabled="busy || loading || !ready"
        @click="recognize"
      >
        <Sparkles v-if="!busy" />{{
          result?.status === "FAILED" ? $t("重试识图") : $t("识别图片")
        }}
      </el-button>
    </template>
  </section>
</template>
