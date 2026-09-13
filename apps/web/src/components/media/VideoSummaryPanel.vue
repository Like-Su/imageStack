<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from "vue";
import { RefreshCw, Sparkles } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage, requestScope } from "@/api/request";
import { useRemoteData } from "@/composables/useRemoteData";
import {
  onVideoSummaryEvent,
  videoSummaryConnection,
  waitForVideoSummaryConnection,
} from "@/composables/videoSummaryEvents";
import { useWorkspaceStore } from "@/stores/workspace";
import { translate } from "@/i18n";
import type {
  VideoSummary,
  VideoSummaryDetail,
  VideoSummaryState,
} from "@/types/media";

const props = defineProps<{ assetId: string }>();
const workspace = useWorkspaceStore();
const scope = requestScope();
let snapshotStarted = false;
const { data, error, loading, refresh, mutate } =
  useRemoteData<VideoSummaryDetail>(
    async (signal) => {
      if (!snapshotStarted) await waitForVideoSummaryConnection(signal);
      signal.throwIfAborted();
      snapshotStarted = true;
      return mediaApi.videoSummary(props.assetId, signal);
    },
    [() => props.assetId],
  );
const result = computed(() => data.value?.result);
const busy = ref(false);
const visibleSegments = ref(100);
const transcript = shallowRef<VideoSummary | null>(null);
const transcriptOpen = ref(false);
const transcriptLoading = ref(false);
const transcriptError = ref("");
const transcriptHasUpdates = computed(
  () =>
    transcript.value &&
    transcript.value.transcribedChunks !== result.value?.transcribedChunks,
);
let transcriptController: AbortController | undefined;
let enqueueController: AbortController | undefined;
let syncTimer: number | undefined;
let syncPending = false;

function mergeState(current: VideoSummaryDetail, state: VideoSummaryState) {
  if (
    current.result &&
    Date.parse(current.result.updatedAt) > Date.parse(state.updatedAt)
  )
    return current;
  return {
    ...current,
    result: { ...state, transcript: null, segments: null },
  };
}

function scheduleSync() {
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncTimer = undefined;
    if (loading.value) syncPending = true;
    else void refresh();
  }, 200);
}

watch(loading, (value) => {
  if (!value && syncPending) {
    syncPending = false;
    scheduleSync();
  }
});

const unsubscribe = onVideoSummaryEvent((event) => {
  if (scope !== requestScope()) return;
  if (event.type === "connected") {
    if (snapshotStarted) scheduleSync();
    return;
  }
  if (event.value.assetId !== props.assetId) return;
  window.clearTimeout(syncTimer);
  syncPending = false;
  if (!data.value && !loading.value) scheduleSync();
  else mutate((current) => mergeState(current, event.value.result));
});

async function loadTranscript(force = false) {
  const currentResult = result.value;
  if (!currentResult || transcriptLoading.value || scope !== requestScope())
    return;
  if (
    !force &&
    transcript.value?.transcribedChunks === currentResult.transcribedChunks
  )
    return;
  transcriptController?.abort();
  const current = new AbortController();
  transcriptController = current;
  const assetId = props.assetId;
  transcriptLoading.value = true;
  transcriptError.value = "";
  try {
    const detail = await mediaApi.videoTranscript(assetId, current.signal);
    if (
      current.signal.aborted ||
      assetId !== props.assetId ||
      scope !== requestScope()
    )
      return;
    transcript.value = detail.result;
    const state = detail.result;
    if (state) mutate((value) => mergeState(value, state));
  } catch (cause) {
    if (
      !current.signal.aborted &&
      assetId === props.assetId &&
      scope === requestScope()
    )
      transcriptError.value = getErrorMessage(cause);
  } finally {
    if (transcriptController === current) {
      transcriptLoading.value = false;
      if (
        !current.signal.aborted &&
        !transcriptError.value &&
        transcriptOpen.value &&
        transcriptHasUpdates.value &&
        currentResult.transcribedChunks !== result.value?.transcribedChunks &&
        (result.value?.stage === "SUMMARIZING" ||
          result.value?.status === "READY" ||
          result.value?.status === "FAILED")
      )
        void loadTranscript();
    }
  }
}

function toggleTranscript(event: Event) {
  transcriptOpen.value = (event.currentTarget as HTMLDetailsElement).open;
  if (transcriptOpen.value) void loadTranscript();
  else {
    transcriptController?.abort();
    transcriptLoading.value = false;
  }
}

watch([() => result.value?.status, () => result.value?.stage], () => {
  if (
    transcriptOpen.value &&
    (result.value?.stage === "SUMMARIZING" ||
      result.value?.status === "READY" ||
      result.value?.status === "FAILED")
  )
    void loadTranscript();
});

watch(
  () => props.assetId,
  () => {
    window.clearTimeout(syncTimer);
    syncPending = false;
    transcriptController?.abort();
    enqueueController?.abort();
    transcriptController = undefined;
    enqueueController = undefined;
    transcript.value = null;
    transcriptOpen.value = false;
    transcriptLoading.value = false;
    transcriptError.value = "";
    busy.value = false;
    visibleSegments.value = 100;
  },
);

onScopeDispose(() => {
  unsubscribe();
  window.clearTimeout(syncTimer);
  transcriptController?.abort();
  enqueueController?.abort();
});

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
  const current = new AbortController();
  enqueueController = current;
  try {
    if (
      !(await workspace.confirm({
        title: translate("转写并总结视频？"),
        message: translate(
          "音频将发送到配置的语音转写服务，转写文字将发送到 AI 服务生成摘要，可能产生模型调用费用。",
        ),
        confirmLabel: translate("开始视频总结"),
      })) ||
      assetId !== props.assetId ||
      current.signal.aborted ||
      scope !== requestScope()
    )
      return;
    const queued = await mediaApi.summarizeVideo(assetId, current.signal);
    if (
      assetId !== props.assetId ||
      current.signal.aborted ||
      scope !== requestScope()
    )
      return;
    if (queued.queued)
      workspace.notify(translate("视频已进入后台转写与总结队列"));
    mutate((value) =>
      queued.detail.result
        ? mergeState(
            { ...value, ...queued.detail, result: value.result },
            queued.detail.result,
          )
        : value,
    );
  } catch (failure) {
    if (
      assetId === props.assetId &&
      !current.signal.aborted &&
      scope === requestScope()
    )
      workspace.notify(getErrorMessage(failure), "error");
  } finally {
    if (enqueueController === current) busy.value = false;
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
    <p
      v-if="result?.status === 'PROCESSING' && result.transcribedChunks"
      class="mt-2 text-xs text-faint"
    >
      {{
        $t("已完成 {value1} 段语音转写，进度由服务端推送。", {
          value1: result.transcribedChunks,
        })
      }}
    </p>
    <p
      v-if="
        videoSummaryConnection === 'reconnecting' ||
        videoSummaryConnection === 'offline'
      "
      class="mt-2 text-[10px] leading-5 text-warn"
    >
      {{
        $t("推送连接暂不可用，将自动恢复；也可手动刷新状态，不会启用定时查询。")
      }}
    </p>
    <details
      v-if="result && result.transcribedChunks > 0"
      class="mt-3 text-xs text-soft"
      @toggle="toggleTranscript"
    >
      <summary class="cursor-pointer text-ai">
        {{ $t("查看语音转写（保留原语言）") }}
      </summary>
      <p v-if="result.stage === 'TRANSCRIBING'" class="mt-2 text-xs text-faint">
        {{ $t("转写尚未完成，以下为已保存的部分内容。") }}
      </p>
      <p
        v-if="transcriptLoading"
        class="mt-2 text-xs text-faint"
        aria-live="polite"
      >
        {{ $t("正在按需读取语音转写…") }}
      </p>
      <p v-if="transcriptError" class="mt-2 text-xs text-err" role="alert">
        {{ transcriptError }}
      </p>
      <el-button
        v-if="transcriptError || transcriptHasUpdates"
        text
        native-type="button"
        :disabled="transcriptLoading"
        @click="loadTranscript(true)"
        >{{
          transcriptError ? $t("重试读取转写") : $t("加载最新转写")
        }}</el-button
      >
      <div
        v-if="transcript"
        class="mt-2 max-h-72 space-y-2 overflow-auto whitespace-pre-wrap break-words leading-6"
      >
        <template v-if="transcript.segments?.length">
          <p
            v-for="(segment, index) in transcript.segments.slice(
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
            v-if="transcript.segments.length > visibleSegments"
            text
            native-type="button"
            @click="visibleSegments += 100"
            >{{ $t("显示更多转写内容") }}</el-button
          >
        </template>
        <p v-else>
          {{ transcript.transcript || $t("未检测到可识别的语音。") }}
        </p>
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
      :disabled="busy || !data.configured"
      @click="summarize()"
    >
      {{
        result?.status === "FAILED" ? $t("重试视频总结") : $t("开始视频总结")
      }}
    </el-button>
    <p class="mt-3 text-[10px] leading-5 text-faint">
      {{ $t("状态和摘要由服务端推送，完整转写仅在展开时读取并缓存。") }}
      <br />
      {{
        $t(
          "摘要基于视频语音，不包含画面理解；转写和 AI 总结可能有误，请以原视频为准。",
        )
      }}
    </p>
  </section>
</template>
