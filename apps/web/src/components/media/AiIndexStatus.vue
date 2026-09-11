<script setup lang="ts">
import { translate } from "@/i18n";
import { computed, onScopeDispose, ref, watch } from "vue";
import { RefreshCw, Sparkles } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useRemoteData } from "@/composables/useRemoteData";
import { useWorkspaceStore } from "@/stores/workspace";
import type { AiIndexStatus } from "@/types/media";

const workspace = useWorkspaceStore();
const {
  data: status,
  error,
  loading,
  refresh,
} = useRemoteData<AiIndexStatus>(mediaApi.aiStatus);
const busy = ref(false);
const eligible = computed(() =>
  status.value
    ? Math.min(
        status.value.batchSize,
        status.value.unindexed + status.value.counts.FAILED,
      )
    : 0,
);
let timer: number | undefined;

watch(status, (value, previous) => {
  window.clearTimeout(timer);
  if (previous && value && value.counts.READY !== previous.counts.READY)
    workspace.invalidate();
  if (value?.configured)
    timer = window.setTimeout(
      () => {
        void refresh();
      },
      value.counts.PENDING + value.counts.PROCESSING > 0 ? 5000 : 15000,
    );
});
onScopeDispose(() => window.clearTimeout(timer));

async function enqueue() {
  if (
    busy.value ||
    !status.value?.configured ||
    !eligible.value ||
    !workspace.can("asset:edit")
  )
    return;
  busy.value = true;
  try {
    if (
      !(await workspace.confirm({
        title: translate("补建 AI 图片索引？"),
        message: translate(
          "将最多 {value1} 张图片的压缩图发送到已配置的 AI 服务，可能产生调用费用。只处理未识别或识别失败的图片，不修改人工标签。",
          { value1: eligible.value },
        ),
        confirmLabel: translate("开始识图"),
      }))
    )
      return;
    const result = await mediaApi.indexImages();
    workspace.notify(
      translate("已将 {value1} 张图片加入识图队列。", {
        value1: result.queued,
      }),
      "success",
    );
    await refresh();
  } catch (failure) {
    workspace.notify(getErrorMessage(failure), "error");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section
    class="mx-4 mb-5 rounded-xl border border-ai/20 bg-panel p-4 sm:mx-6"
    :aria-label="$t('AI 图片索引状态')"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="flex items-center gap-2 text-xs font-semibold text-ai">
        <Sparkles class="size-4" />{{ $t("图片内容索引") }}
      </h3>
      <div class="flex items-center gap-2">
        <el-button
          text
          circle
          native-type="button"
          :aria-label="$t('刷新识图进度')"
          :disabled="loading"
          @click="refresh()"
        >
          <RefreshCw :class="{ 'animate-spin': loading }" />
        </el-button>
        <el-button
          :loading="busy"
          v-if="workspace.can('asset:edit')"
          native-type="button"
          :disabled="busy || !status?.configured || !eligible"
          @click="enqueue"
        >
          <Sparkles v-if="!busy" />{{ $t("补建索引 / 重试失败") }}</el-button
        >
      </div>
    </div>
    <p v-if="error" class="mt-3 text-xs text-err">{{ error }}</p>
    <template v-else-if="status">
      <p
        v-if="status.configurationError"
        class="mt-3 text-xs leading-6 text-warn"
      >
        {{ status.configurationError }}
      </p>
      <p
        class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-soft"
        aria-live="polite"
      >
        <span>{{
          $t("已识图 {value1} / {value2}", {
            value1: status.counts.READY,
            value2: status.total,
          })
        }}</span>
        <span>{{ $t("等待 {value1}", { value1: status.counts.PENDING }) }}</span
        ><span>{{
          $t("识别中 {value1}", { value1: status.counts.PROCESSING })
        }}</span>
        <span :class="{ 'text-err': status.counts.FAILED > 0 }">{{
          $t("失败 {value1}", { value1: status.counts.FAILED })
        }}</span>
        <span>{{ $t("未建索引 {value1}", { value1: status.unindexed }) }}</span>
      </p>
      <p class="mt-3 text-[11px] leading-6 text-faint">
        {{
          $t(
            "{value1} 已有图片需手动补建，每批最多 {value2} 张；描述、AI 关键词和识别文字可直接搜索。 {value3}",
            {
              value1: status.autoIndex
                ? $t("新图片在媒体处理完成后自动识别。")
                : $t("新图片自动识图未启用。"),
              value2: status.batchSize,
              value3: status.model
                ? $t("当前模型：{value1}。", { value1: status.model })
                : "",
            },
          )
        }}
      </p>
    </template>
  </section>
</template>
