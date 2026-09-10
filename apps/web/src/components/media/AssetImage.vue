<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ImageOff, Image, LoaderCircle } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { ApiError, getErrorMessage } from "@/api/request";

const props = withDefaults(
  defineProps<{
    assetId: string;
    name?: string;
    trash?: boolean;
    version?: string;
    contain?: boolean;
  }>(),
  { name: "媒体预览", trash: false },
);
const host = ref<HTMLElement | null>(null);
const visible = ref(false);
const source = ref("");
const state = ref<"loading" | "processing" | "error" | "ready">("loading");
const errorMessage = ref("");
let observer: IntersectionObserver | null = null;
let controller: AbortController | null = null;
let timer: number | undefined;

function clear() {
  controller?.abort();
  window.clearTimeout(timer);
  if (source.value) URL.revokeObjectURL(source.value);
  source.value = "";
}

async function retrieve(current: AbortController, attempt = 0) {
  try {
    const blob = await mediaApi.thumbnail(
      props.assetId,
      props.trash,
      current.signal,
    );
    if (current.signal.aborted) return;
    source.value = URL.createObjectURL(blob);
    state.value = "ready";
  } catch (error) {
    if (current.signal.aborted) return;
    if (
      error instanceof ApiError &&
      error.code === "MEDIA_PENDING" &&
      attempt < 8
    ) {
      state.value = "processing";
      timer = window.setTimeout(
        () => {
          void retrieve(current, attempt + 1);
        },
        Math.min(15, error.retryAfter ?? 3) * 1000,
      );
    } else {
      state.value =
        error instanceof ApiError && error.code === "MEDIA_PENDING"
          ? "processing"
          : "error";
      errorMessage.value = getErrorMessage(error);
    }
  }
}

watch(
  [visible, () => props.assetId, () => props.trash, () => props.version],
  () => {
    clear();
    state.value = "loading";
    errorMessage.value = "";
    if (visible.value && props.assetId) {
      controller = new AbortController();
      void retrieve(controller);
    }
  },
);

onMounted(() => {
  if (!("IntersectionObserver" in window)) {
    visible.value = true;
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      visible.value = entries.some((entry) => entry.isIntersecting);
    },
    { rootMargin: "400px" },
  );
  if (host.value) observer.observe(host.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  clear();
});
</script>

<template>
  <div
    ref="host"
    class="relative size-full overflow-hidden bg-panel2"
    :title="errorMessage || undefined"
  >
    <img
      v-if="source && state === 'ready'"
      :src="source"
      :alt="name"
      class="size-full"
      :class="contain ? 'object-contain' : 'object-cover'"
      decoding="async"
      @error="state = 'error'"
    />
    <div
      v-else
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-faint"
      role="img"
      :aria-label="`${name}：${state === 'error' ? '预览不可用' : '缩略图生成中'}`"
    >
      <ImageOff v-if="state === 'error'" class="size-6" aria-hidden="true" />
      <LoaderCircle
        v-else-if="visible && state === 'loading'"
        class="size-5 animate-spin"
        aria-hidden="true"
      />
      <Image v-else class="size-6" aria-hidden="true" />
      <span
        v-if="state === 'processing' || state === 'error'"
        class="text-[10px]"
        >{{ state === "processing" ? "缩略图生成中" : "预览不可用" }}</span
      >
    </div>
  </div>
</template>
