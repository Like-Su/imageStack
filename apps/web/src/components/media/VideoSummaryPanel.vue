<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RefreshCw, Sparkles } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useRemoteData } from "@/composables/useRemoteData";
import { useVisiblePolling } from "@/composables/useVisiblePolling";
import { useWorkspaceStore } from "@/stores/workspace";
import { translate } from "@/i18n";
import type { VideoSummaryDetail } from "@/types/media";

const props = defineProps<{ assetId: string }>();
const workspace = useWorkspaceStore();
const { data, error, loading, refresh } = useRemoteData<VideoSummaryDetail>(
  (signal) => mediaApi.videoSummary(props.assetId, signal),
  [() => props.assetId],
  { resources: ["video-summaries"] },
);
const result = computed(() => data.value?.result);
const busy = ref(false);
const visibleSegments = ref(100);
watch(
  () => props.assetId,
  () => {
    visibleSegments.value = 100;
  },
);
useVisiblePolling(refresh, () =>
  data.value?.configured &&
  result.value &&
  ["PENDING", "PROCESSING"].includes(result.value.status)
    ? 5000
    : false,
);

function timestamp(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

async function summarize() {
  if (busy.value || !data.value?.configured || !workspace.can("asset:edit"))
    return;
  busy.value = true;
  const assetId = props.assetId;
  try {
    if (
      !(await workspace.confirm({
        title: translate("转写并总结视频？"),
        message: translate(
          "音频将发送到配置的语音转写服务，转写文字将发送到 AI 服务生成摘要，可能产生模型调用费用。",
        ),
        confirmLabel: translate("开始视频总结"),
      })) ||
      assetId !== props.assetId
    )
      return;
    const queued = await mediaApi.summarizeVideo(assetId);
    if (assetId !== props.assetId) return;
    if (queued.queued)
      workspace.notify(translate("视频已进入后台转写与总结队列"));
    await refresh();
  } catch (failure) {
    if (assetId === props.assetId)
      workspace.notify(getErrorMessage(failure), "error");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section
    class="mh-gradient rounded-xl border border-ai/20 p-4"
    data-testid="video-summary-panel"
  >
    <div class="flex items-center justify-between gap-2">
      <h4 class="flex items-center gap-2 text-xs font-semibold text-ai">
        <Sparkles class="size-4" />{{ $t("视频语音总结") }}
      </h4>
      <el-button
        text
        circle
        native-type="button"
        :disabled="loading"
        :aria-label="$t('刷新视频总结')"
        @click="refresh()"
      >
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </el-button>
    </div>
    <p v-if="error" class="mt-2 text-xs leading-6 text-err">{{ error }}</p>
    <p v-if="data?.configurationError" class="mt-2 text-xs leading-6 text-warn">
      {{ data.configurationError }}
    </p>
    <p
      v-if="result?.status === 'READY'"
      class="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-soft"
    >
      {{ result.summary }}
    </p>
    <p v-else class="mt-2 text-xs leading-6 text-soft" aria-live="polite">
      {{
        result?.status === "PROCESSING"
          ? result.stage === "SUMMARIZING"
            ? $t("语音转写完成，正在生成视频总结…")
            : $t("正在提取音频并转写中英文语音…")
          : result?.status === "PENDING"
            ? $t("已进入视频总结队列，等待后台处理…")
            : result?.status === "FAILED"
              ? $t("视频总结失败，已完成的转写会保留，可重试。")
              : loading
                ? $t("正在读取视频总结…")
                : $t("尚未生成视频总结，可手动开始转写与总结。")
      }}
    </p>
    <p v-if="result?.error" class="mt-2 text-xs leading-6 text-warn">
      {{ result.error }}
    </p>
    <details v-if="result?.transcript" class="mt-3 text-xs text-soft">
      <summary class="cursor-pointer text-ai">
        {{ $t("查看语音转写（保留原语言）") }}
      </summary>
      <p v-if="result.stage === 'TRANSCRIBING'" class="mt-2 text-xs text-faint">
        {{ $t("转写尚未完成，以下为已保存的部分内容。") }}
      </p>
      <div
        class="mt-2 max-h-72 space-y-2 overflow-auto whitespace-pre-wrap break-words leading-6"
      >
        <template v-if="result.segments?.length">
          <p
            v-for="(segment, index) in result.segments.slice(
              0,
              visibleSegments,
            )"
            :key="index"
          >
            <span class="mr-2 font-mono text-[10px] text-faint">{{
              timestamp(segment.start)
            }}</span
            >{{ segment.text }}
          </p>
          <el-button
            v-if="result.segments.length > visibleSegments"
            text
            native-type="button"
            @click="visibleSegments += 100"
            >{{ $t("显示更多转写内容") }}</el-button
          >
        </template>
        <p v-else>{{ result.transcript }}</p>
      </div>
    </details>
    <el-button
      v-if="
        data &&
        (!result || result.status === 'FAILED') &&
        workspace.can('asset:edit')
      "
      class="mt-3"
      native-type="button"
      :loading="busy"
      :disabled="!data.configured"
      @click="summarize()"
    >
      {{
        result?.status === "FAILED" ? $t("重试视频总结") : $t("开始视频总结")
      }}
    </el-button>
    <p class="mt-3 text-[10px] leading-5 text-faint">
      {{
        $t(
          "摘要基于视频语音，不包含画面理解；转写和 AI 总结可能有误，请以原视频为准。",
        )
      }}
    </p>
  </section>
</template>
