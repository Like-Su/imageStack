<script setup lang="ts">
import { ref, watch } from "vue";
import { ImageOff } from "lucide-vue-next";
import ImageLoading from "./ImageLoading.vue";

const props = withDefaults(
  defineProps<{
    src: string;
    alt: string;
    contain?: boolean;
    loading?: "eager" | "lazy";
  }>(),
  { loading: "eager" },
);
const emit = defineEmits<{ load: [event: Event]; error: [event: Event] }>();
const imageElement = ref<HTMLImageElement | null>(null);
const ready = ref(false);
const failed = ref(false);

watch(
  () => props.src,
  () => {
    ready.value = false;
    failed.value = false;
  },
  { flush: "sync" },
);

async function loaded(event: Event) {
  const image = event.currentTarget as HTMLImageElement;
  const source = props.src;
  if (image !== imageElement.value) return;
  try {
    if (typeof image.decode === "function") await image.decode();
    if (image !== imageElement.value || source !== props.src) return;
    ready.value = true;
    failed.value = false;
    emit("load", event);
  } catch {
    if (image !== imageElement.value || source !== props.src) return;
    failed.value = true;
    emit("error", event);
  }
}

function failedToLoad(event: Event) {
  if (event.currentTarget !== imageElement.value) return;
  ready.value = false;
  failed.value = true;
  emit("error", event);
}
</script>

<template>
  <div
    class="relative size-full overflow-hidden bg-panel2"
    :aria-busy="!ready && !failed"
  >
    <img
      :key="src"
      ref="imageElement"
      :src="src"
      :alt="alt"
      :loading="loading"
      class="loading-image size-full transition-opacity duration-300 motion-reduce:transition-none"
      :class="[
        contain ? 'object-contain' : 'object-cover',
        ready ? 'opacity-100' : 'opacity-0',
      ]"
      :aria-hidden="!ready || undefined"
      decoding="async"
      draggable="false"
      @load="loaded"
      @error="failedToLoad"
    />
    <ImageLoading
      v-if="!ready && !failed"
      :label="`${alt}：${$t('图片加载中')}`"
    />
    <div
      v-else-if="failed"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-faint"
      role="img"
      :aria-label="`${alt}：${$t('预览不可用')}`"
    >
      <ImageOff class="size-6" aria-hidden="true" />
      <span class="text-[10px]">{{ $t("预览不可用") }}</span>
    </div>
  </div>
</template>

<style scoped>
:global([data-media-motion="reduced"]) .loading-image {
  transition: none;
}
</style>
