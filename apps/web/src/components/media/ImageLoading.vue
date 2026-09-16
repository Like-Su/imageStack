<script setup lang="ts">
import { LoaderCircle } from "lucide-vue-next";

defineProps<{ label?: string; showLabel?: boolean }>();
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden bg-panel2 p-2 text-faint"
    role="status"
    :aria-label="label ?? $t('图片加载中')"
  >
    <span class="image-loading-shimmer absolute inset-0" aria-hidden="true" />
    <LoaderCircle
      class="image-loading-spinner relative size-5 animate-spin text-accent"
      aria-hidden="true"
    />
    <span v-if="showLabel" class="relative text-[10px]">{{
      label ?? $t("图片加载中")
    }}</span>
  </div>
</template>

<style scoped>
.image-loading-shimmer {
  background: linear-gradient(
    110deg,
    transparent 20%,
    color-mix(in srgb, var(--app-ghost) 8%, transparent) 50%,
    transparent 80%
  );
  animation: image-loading-shimmer 1.5s ease-in-out infinite;
}

@keyframes image-loading-shimmer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-loading-shimmer,
  .image-loading-spinner {
    animation: none;
  }
}

:global([data-media-motion="reduced"]) .image-loading-shimmer,
:global([data-media-motion="reduced"]) .image-loading-spinner {
  animation: none;
}
</style>
