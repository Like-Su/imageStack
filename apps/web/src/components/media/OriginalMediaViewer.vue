<script setup lang="ts">
import { i18n, translate } from "@/i18n";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from "vue";
import {
  Download,
  Expand,
  LoaderCircle,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
  Film,
  ImageOff,
} from "lucide-vue-next";
import { mediaApi, mediaStreamUrl } from "@/api/media";
import type Hls from "hls.js";
import { ApiError, getErrorMessage } from "@/api/request";
import { useAssetActions } from "@/composables/useAssetActions";
import { formatBytes, formatDuration } from "@/composables/mediaFormat";
import { useWorkspaceStore } from "@/stores/workspace";
import type { AssetDetail } from "@/types/media";
import AssetImage from "./AssetImage.vue";

const props = defineProps<{ asset: AssetDetail; shared?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const workspace = useWorkspaceStore();
const { downloading, download } = useAssetActions();
const viewport = ref<HTMLDivElement | null>(null);
const videoElement = ref<HTMLVideoElement | null>(null);
const titleId = useId();
const helpId = useId();
const isVideo = computed(() => props.asset.type === "VIDEO");
const mode = ref<"original" | "compatible">(
  isVideo.value ? "compatible" : "original",
);
const source = ref("");
const sourceIsHls = ref(false);
const loading = ref(false);
const loadingMessage = ref("");
const mediaReady = ref(false);
const buffering = ref(false);
const error = ref("");
const scale = ref(1);
const fitted = ref(true);
const dragging = ref(false);
const dimensions = ref({
  width: props.asset.width || 1,
  height: props.asset.height || 1,
});
const viewportSize = ref({ width: 1, height: 1 });
const fitScale = computed(() =>
  Math.min(
    1,
    viewportSize.value.width / dimensions.value.width,
    viewportSize.value.height / dimensions.value.height,
  ),
);
const minimumScale = computed(() => Math.min(0.05, fitScale.value));
const displayWidth = computed(() =>
  Math.max(1, dimensions.value.width * scale.value),
);
const displayHeight = computed(() =>
  Math.max(1, dimensions.value.height * scale.value),
);
const canvasStyle = computed(() => ({
  width: `${displayWidth.value}px`,
  height: `${displayHeight.value}px`,
}));
let controller: AbortController | null = null;
let hlsPlayer: Hls | null = null;
let playerVersion = 0;
let retryTimer: number | undefined;
let observer: ResizeObserver | null = null;
let zoomFrame: number | undefined;
let zoomVersion = 0;
let pendingZoom:
  { value: number; anchor?: { clientX: number; clientY: number } } | undefined;
let dragFrame: number | undefined;
let pendingDrag: { left: number; top: number } | undefined;
let pointer: {
  id: number;
  left: number;
  top: number;
  clientX: number;
  clientY: number;
} | null = null;

function clearMedia() {
  cancelZoom();
  playerVersion += 1;
  hlsPlayer?.destroy();
  hlsPlayer = null;
  controller?.abort();
  window.clearTimeout(retryTimer);
  stopDrag();
  if (videoElement.value) {
    videoElement.value.pause();
    videoElement.value.removeAttribute("src");
    videoElement.value.load();
  }
  if (source.value.startsWith("blob:")) URL.revokeObjectURL(source.value);
  source.value = "";
  sourceIsHls.value = false;
  mediaReady.value = false;
  buffering.value = false;
}

async function retrieve(
  current: AbortController,
  kind: typeof mode.value,
  assetId: string,
  attempt = 0,
) {
  try {
    if (isVideo.value || kind === "original") {
      const ticket = await mediaApi.streamTicket(
        assetId,
        kind === "compatible" ? "hls" : "original",
        current.signal,
      );
      if (current.signal.aborted || controller !== current) return;
      sourceIsHls.value = ticket.kind === "hls";
      source.value = mediaStreamUrl(ticket.path);
      loading.value = false;
      return;
    }
    const blob = await mediaApi.preview(assetId, current.signal);
    if (current.signal.aborted || controller !== current) return;
    source.value = URL.createObjectURL(blob);
    loading.value = false;
  } catch (failure) {
    if (current.signal.aborted || controller !== current) return;
    if (
      kind === "compatible" &&
      failure instanceof ApiError &&
      failure.code === "MEDIA_PENDING" &&
      attempt < 40
    ) {
      loadingMessage.value = translate(
        "后台正在生成 HLS 视频流，可切回原视频或稍后再试…",
      );
      retryTimer = window.setTimeout(
        () => {
          void retrieve(current, kind, assetId, attempt + 1);
        },
        Math.min(15, Math.max(3 * (attempt + 1), failure.retryAfter ?? 3)) *
          1000,
      );
      return;
    }
    loading.value = false;
    error.value =
      failure instanceof ApiError && failure.code === "MEDIA_PENDING"
        ? translate("HLS 视频流仍在处理中，请稍后重试；原视频仍可查看和下载。")
        : getErrorMessage(failure);
  }
}

function loadMedia(kind: typeof mode.value = mode.value) {
  clearMedia();
  mode.value = kind;
  error.value = "";
  loading.value = true;
  loadingMessage.value =
    kind === "original"
      ? isVideo.value
        ? translate("正在连接原视频流…")
        : translate("正在读取原图片…")
      : translate("正在加载 HLS 播放列表与首段视频…");
  dimensions.value = {
    width: props.asset.width || 1,
    height: props.asset.height || 1,
  };
  fit();
  controller = new AbortController();
  void retrieve(controller, kind, props.asset.id);
}

async function attachVideo(element: HTMLVideoElement | null, url: string) {
  if (!element || !url || !isVideo.value) {
    playerVersion += 1;
    hlsPlayer?.destroy();
    hlsPlayer = null;
    return;
  }
  const version = ++playerVersion;
  hlsPlayer?.destroy();
  hlsPlayer = null;
  if (
    !sourceIsHls.value ||
    element.canPlayType("application/vnd.apple.mpegurl")
  ) {
    element.src = url;
    return;
  }
  try {
    const { default: HlsPlayer } = await import("hls.js");
    if (
      version !== playerVersion ||
      source.value !== url ||
      videoElement.value !== element
    )
      return;
    if (!HlsPlayer.isSupported()) {
      error.value = translate(
        "此浏览器不支持 HLS 播放，请查看原视频或更换浏览器。",
      );
      return;
    }
    const player = new HlsPlayer({
      enableWorker: true,
      maxBufferLength: 20,
      maxMaxBufferLength: 30,
      backBufferLength: 30,
      maxBufferSize: 20 * 1024 * 1024,
    });
    hlsPlayer = player;
    let mediaRecoveries = 0;
    player.on(HlsPlayer.Events.ERROR, (_event, data) => {
      if (hlsPlayer !== player || !data.fatal) return;
      if (
        data.type === HlsPlayer.ErrorTypes.MEDIA_ERROR &&
        mediaRecoveries < 1
      ) {
        mediaRecoveries += 1;
        player.recoverMediaError();
        return;
      }
      error.value = translate(
        "视频流加载失败或播放凭证失效，请重新加载；也可查看或下载原视频。",
      );
      mediaReady.value = false;
      buffering.value = false;
      hlsPlayer = null;
      player.destroy();
    });
    player.loadSource(url);
    player.attachMedia(element);
  } catch (failure) {
    if (version === playerVersion) error.value = getErrorMessage(failure);
  }
}

function resizeViewport() {
  const element = viewport.value;
  if (!element) return;
  viewportSize.value = {
    width: Math.max(1, element.clientWidth),
    height: Math.max(1, element.clientHeight),
  };
  if (fitted.value) fit();
}

function fit() {
  cancelZoom();
  fitted.value = true;
  scale.value = fitScale.value;
  void nextTick(() => viewport.value?.scrollTo({ left: 0, top: 0 }));
}

function cancelZoom() {
  if (zoomFrame !== undefined) window.cancelAnimationFrame(zoomFrame);
  zoomFrame = undefined;
  pendingZoom = undefined;
  zoomVersion += 1;
}

function zoomTo(value: number, anchor?: { clientX: number; clientY: number }) {
  if (!viewport.value || !mediaReady.value) return;
  pendingZoom = {
    value: Math.min(8, Math.max(minimumScale.value, value)),
    anchor: anchor
      ? { clientX: anchor.clientX, clientY: anchor.clientY }
      : undefined,
  };
  zoomFrame ??= window.requestAnimationFrame(() => {
    zoomFrame = undefined;
    const pending = pendingZoom;
    pendingZoom = undefined;
    if (pending) void applyZoom(pending.value, pending.anchor);
  });
}

async function applyZoom(
  value: number,
  anchor?: { clientX: number; clientY: number },
) {
  const element = viewport.value;
  if (!element || !mediaReady.value) return;
  const version = zoomVersion;
  const bounds = element.getBoundingClientRect();
  const { width, height } = viewportSize.value;
  const anchorX = anchor ? anchor.clientX - bounds.left : width / 2;
  const anchorY = anchor ? anchor.clientY - bounds.top : height / 2;
  const contentX =
    (element.scrollLeft +
      anchorX -
      Math.max(0, (width - displayWidth.value) / 2)) /
    scale.value;
  const contentY =
    (element.scrollTop +
      anchorY -
      Math.max(0, (height - displayHeight.value) / 2)) /
    scale.value;
  fitted.value = false;
  scale.value = Math.min(8, Math.max(minimumScale.value, value));
  await nextTick();
  if (viewport.value !== element || version !== zoomVersion) return;
  element.scrollLeft =
    contentX * scale.value +
    Math.max(0, (width - displayWidth.value) / 2) -
    anchorX;
  element.scrollTop =
    contentY * scale.value +
    Math.max(0, (height - displayHeight.value) / 2) -
    anchorY;
}

function wheel(event: WheelEvent) {
  if (!mediaReady.value || isVideo.value || !event.deltaY) return;
  event.preventDefault();
  zoomTo(
    (pendingZoom?.value ?? scale.value) * (event.deltaY < 0 ? 1.15 : 1 / 1.15),
    event,
  );
}

function startDrag(event: PointerEvent) {
  const element = viewport.value;
  if (
    !element ||
    isVideo.value ||
    !mediaReady.value ||
    event.button !== 0 ||
    !event.isPrimary
  )
    return;
  event.preventDefault();
  pointer = {
    id: event.pointerId,
    left: element.scrollLeft,
    top: element.scrollTop,
    clientX: event.clientX,
    clientY: event.clientY,
  };
  dragging.value = true;
  element.setPointerCapture(event.pointerId);
}

function drag(event: PointerEvent) {
  if (!pointer || pointer.id !== event.pointerId || !viewport.value) return;
  pendingDrag = {
    left: pointer.left - event.clientX + pointer.clientX,
    top: pointer.top - event.clientY + pointer.clientY,
  };
  dragFrame ??= window.requestAnimationFrame(flushDrag);
}

function flushDrag() {
  if (dragFrame !== undefined) window.cancelAnimationFrame(dragFrame);
  dragFrame = undefined;
  if (pendingDrag && viewport.value) {
    viewport.value.scrollLeft = pendingDrag.left;
    viewport.value.scrollTop = pendingDrag.top;
  }
  pendingDrag = undefined;
}

function stopDrag() {
  flushDrag();
  const captured = pointer;
  pointer = null;
  dragging.value = false;
  if (captured && viewport.value?.hasPointerCapture(captured.id))
    viewport.value.releasePointerCapture(captured.id);
}

function ready(event: Event) {
  const element = event.target;
  if (!source.value || loading.value) return;
  if (
    element instanceof HTMLImageElement &&
    element.currentSrc === new URL(source.value, window.location.href).href
  )
    dimensions.value = {
      width: element.naturalWidth || dimensions.value.width,
      height: element.naturalHeight || dimensions.value.height,
    };
  else if (
    element instanceof HTMLVideoElement &&
    element === videoElement.value
  )
    dimensions.value = {
      width: element.videoWidth || dimensions.value.width,
      height: element.videoHeight || dimensions.value.height,
    };
  else return;
  mediaReady.value = true;
  fit();
}

function setBuffering(event: Event, value: boolean) {
  if (!isVideo.value || event.target !== videoElement.value) return;
  buffering.value = value;
}

function cannotDisplay(event: Event) {
  if (!source.value || loading.value) return;
  const element = event.target;
  if (
    element instanceof HTMLImageElement &&
    element.currentSrc !== new URL(source.value, window.location.href).href
  )
    return;
  videoElement.value?.pause();
  mediaReady.value = false;
  buffering.value = false;
  error.value = isVideo.value
    ? mode.value === "original"
      ? translate(
          "当前浏览器无法播放此原视频的容器或编码。请切换 HLS 流播，或下载原视频用本地播放器打开。",
        )
      : translate(
          "浏览器无法播放 HLS 视频流。请重试或下载原视频用本地播放器打开。",
        )
    : translate(
        "当前浏览器无法显示此原图片。请下载原文件，使用支持该格式的浏览器或图片查看器打开。",
      );
}

function keyboard(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey || !mediaReady.value)
    return;
  if ((event.target as HTMLElement).matches("input, textarea, select")) return;
  if (["+", "=", "-", "0", "1"].includes(event.key)) {
    event.preventDefault();
    if (event.key === "0") fit();
    else
      void zoomTo(
        event.key === "1"
          ? 1
          : scale.value * (event.key === "-" ? 1 / 1.25 : 1.25),
      );
  }
}

function downloadOriginal() {
  void download(props.asset, undefined, Boolean(props.shared));
}

watch(
  () => props.asset.id,
  () => loadMedia(isVideo.value ? "compatible" : "original"),
);
watch(
  [videoElement, source],
  ([element, url]) => {
    void attachVideo(element, url);
  },
  { flush: "post" },
);
function observeViewport() {
  resizeViewport();
  if (typeof ResizeObserver !== "undefined") {
    observer?.disconnect();
    observer = new ResizeObserver(resizeViewport);
    if (viewport.value) observer.observe(viewport.value);
  }
}
onMounted(() => {
  window.addEventListener("resize", resizeViewport);
  loadMedia(isVideo.value ? "compatible" : "original");
});
onBeforeUnmount(() => {
  clearMedia();
  observer?.disconnect();
  window.removeEventListener("resize", resizeViewport);
});
</script>

<template>
  <el-dialog
    :model-value="true"
    :title="asset.name"
    :show-close="false"
    :close-on-click-modal="false"
    fullscreen
    append-to-body
    class="original-viewer"
    :aria-labelledby="titleId"
    :aria-describedby="helpId"
    @opened="observeViewport"
    @close="emit('close')"
    @click.self="emit('close')"
    @keydown="keyboard"
  >
    <section class="viewer-shell">
      <header
        class="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6"
      >
        <div class="min-w-0">
          <h2
            :id="titleId"
            class="truncate text-sm font-semibold"
            :title="asset.name"
          >
            {{ asset.name }}
          </h2>
          <p class="mt-1 text-[11px] text-white/50">
            {{
              mode === "compatible"
                ? $t("兼容预览 · MP4（非原文件）")
                : isVideo
                  ? $t("原视频")
                  : $t("原图片")
            }}
            · {{ formatBytes(asset.size) }}
            <span v-if="isVideo">
              · {{ formatDuration(asset.durationMs) }}</span
            >
          </p>
        </div>
        <button
          class="viewer-button shrink-0"
          type="button"
          :aria-label="$t('关闭原文件预览')"
          :title="$t('关闭（Esc）')"
          autofocus
          @click="emit('close')"
        >
          <X class="size-5" />
        </button>
      </header>

      <div
        ref="viewport"
        class="viewer-viewport"
        :class="{
          'is-image': !isVideo && mediaReady,
          'is-dragging': dragging,
        }"
        @wheel="wheel"
        @pointerdown="startDrag"
        @pointermove="drag"
        @pointerup="stopDrag"
        @pointercancel="stopDrag"
        @lostpointercapture="stopDrag"
      >
        <AssetImage
          v-if="!isVideo && !mediaReady && !error"
          :asset-id="asset.id"
          :name="asset.name"
          :version="asset.thumbnailRevision ?? asset.status"
          class="!absolute inset-0"
          contain
        />
        <div v-if="source && !error" class="viewer-canvas" :style="canvasStyle">
          <video
            v-if="isVideo"
            ref="videoElement"
            :aria-label="asset.name"
            class="viewer-media"
            :style="canvasStyle"
            controls
            crossorigin="anonymous"
            playsinline
            preload="auto"
            @loadedmetadata="ready"
            @waiting="setBuffering($event, true)"
            @seeking="setBuffering($event, true)"
            @seeked="setBuffering($event, false)"
            @canplay="setBuffering($event, false)"
            @playing="setBuffering($event, false)"
            @error="cannotDisplay"
          />
          <img
            v-else
            :src="source"
            :alt="asset.name"
            class="viewer-media"
            :style="canvasStyle"
            draggable="false"
            decoding="async"
            referrerpolicy="no-referrer"
            @load="ready"
            @error="cannotDisplay"
          />
        </div>
        <div
          v-if="loading || (!mediaReady && !error)"
          class="viewer-message pointer-events-none"
          role="status"
        >
          <LoaderCircle class="size-7 animate-spin text-accent" />
          <p>{{ loadingMessage }}</p>
        </div>
        <div
          v-else-if="isVideo && buffering && !error"
          class="viewer-buffering pointer-events-none"
          role="status"
          :aria-label="$t('视频缓冲中…')"
        >
          <span class="viewer-buffering-badge">
            <LoaderCircle class="size-7 animate-spin text-accent" />
          </span>
        </div>
        <div v-else-if="error" class="viewer-message" role="alert">
          <Film v-if="isVideo" class="size-9 text-white/40" /><ImageOff
            v-else
            class="size-9 text-white/40"
          />
          <p class="max-w-lg leading-7">{{ error }}</p>
          <button class="viewer-button" type="button" @click="loadMedia()">
            <RotateCcw class="size-4" />{{ $t("重新加载") }}
          </button>
        </div>
      </div>

      <footer class="shrink-0 border-t border-white/10 px-3 py-3 sm:px-6">
        <div
          class="flex flex-wrap items-center justify-center gap-2"
          role="group"
          :aria-label="$t('原文件预览操作')"
        >
          <button
            class="viewer-button"
            type="button"
            :aria-label="$t('缩小')"
            :title="$t('缩小（-）')"
            :disabled="!mediaReady || scale <= minimumScale"
            @click="zoomTo(scale / 1.25)"
          >
            <ZoomOut class="size-4" />
          </button>
          <output
            class="min-w-14 text-center font-mono text-xs text-white/70"
            :aria-label="$t('缩放比例')"
            >{{
              (scale * 100).toLocaleString(i18n.global.locale.value, {
                maximumFractionDigits: 1,
              })
            }}%</output
          >
          <button
            class="viewer-button"
            type="button"
            :aria-label="$t('放大')"
            :title="$t('放大（+）')"
            :disabled="!mediaReady || scale >= 8"
            @click="zoomTo(scale * 1.25)"
          >
            <ZoomIn class="size-4" />
          </button>
          <button
            class="viewer-button"
            :class="{ 'is-active': fitted }"
            type="button"
            :title="$t('适应窗口（0）')"
            :disabled="!mediaReady"
            @click="fit"
          >
            <Expand class="size-4" /><span class="hidden sm:inline">{{
              $t("适应窗口")
            }}</span>
          </button>
          <button
            class="viewer-button"
            type="button"
            :title="$t('原始尺寸（1）')"
            :aria-label="$t('原始尺寸 100%')"
            :disabled="!mediaReady"
            @click="zoomTo(1)"
          >
            1:1
          </button>
          <button
            v-if="isVideo"
            class="viewer-button"
            type="button"
            @click="loadMedia(mode === 'original' ? 'compatible' : 'original')"
          >
            <Film class="size-4" />{{
              mode === "original" ? $t("切换 HLS 流播") : $t("查看原视频")
            }}
          </button>
          <button
            class="viewer-button is-primary"
            type="button"
            :disabled="
              downloading || (!shared && !workspace.can('asset:download'))
            "
            @click="downloadOriginal"
          >
            <LoaderCircle
              v-if="downloading"
              class="size-4 animate-spin"
            /><Download v-else class="size-4" />{{
              downloading
                ? $t("准备下载…")
                : isVideo
                  ? $t("下载原视频")
                  : $t("下载原图片")
            }}
          </button>
        </div>
        <p
          :id="helpId"
          class="mt-3 text-center text-[10px] leading-5 text-white/40"
        >
          {{
            $t("{value1} · Esc 关闭", {
              value1: isVideo
                ? $t(
                    "HLS 按需加载约 4 秒的视频分段，无需完整下载；原文件下载支持 HTTP Range。",
                  )
                : $t("滚轮缩放 · 拖动平移 · 动图保留原始动画"),
            })
          }}
        </p>
      </footer>
    </section>
  </el-dialog>
</template>

<style>
.original-viewer {
  position: fixed;
  inset: 0;
  width: 100vw;
  max-width: 100vw;
  height: 100dvh;
  max-height: 100dvh;
  margin: 0;
  padding: clamp(8px, 2vw, 28px);
  overflow: hidden;
  border: 0;
  background: rgb(0 0 0 / 78%);
  color: #f4f4f5;
}
.original-viewer .el-dialog__body {
  height: 100%;
  display: grid;
  place-items: center;
}
.original-viewer .el-dialog__header {
  height: 0;
  padding: 0;
  overflow: hidden;
}
.viewer-shell {
  display: flex;
  flex-direction: column;
  width: min(100%, 1600px);
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 16px;
  background: #0c0f14;
  box-shadow: 0 24px 100px rgb(0 0 0 / 60%);
}
.viewer-viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
  background: #050709;
}
.viewer-viewport.is-image {
  cursor: grab;
  touch-action: none;
}
.viewer-viewport.is-dragging {
  cursor: grabbing;
  user-select: none;
}
.viewer-canvas {
  display: flex;
  min-width: 100%;
  min-height: 100%;
  align-items: center;
  justify-content: center;
}
.viewer-media {
  display: block;
  max-width: none;
  max-height: none;
  flex: none;
  object-fit: contain;
}
.viewer-message {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: rgb(255 255 255 / 65%);
}
.viewer-buffering {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.viewer-buffering-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: rgb(0 0 0 / 55%);
  backdrop-filter: blur(4px);
}
.viewer-button {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 8px;
  padding: 8px 10px;
  background: rgb(255 255 255 / 4%);
  font-size: 12px;
  cursor: pointer;
}
.viewer-button:hover:not(:disabled) {
  background: rgb(255 255 255 / 12%);
}
.viewer-button:focus-visible {
  outline: 2px solid var(--color-accent, #81d4b6);
  outline-offset: 3px;
}
.viewer-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.viewer-button.is-active {
  border-color: color-mix(
    in srgb,
    var(--color-accent, #81d4b6) 40%,
    transparent
  );
  color: var(--color-accent, #81d4b6);
}
.viewer-button.is-primary {
  background: var(--color-accent, #81d4b6);
  border-color: var(--color-accent, #81d4b6);
  color: #091512;
}
.viewer-button.is-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-accent, #81d4b6) 85%, white);
}
</style>
