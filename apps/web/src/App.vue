<script setup lang="ts">
import { LoaderCircle } from "lucide-vue-next";
import { RouterView } from "vue-router";
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" v-if="Component" />
    <div
      v-else
      class="flex min-h-svh items-center justify-center gap-3 bg-ink text-sm text-soft"
      role="status"
    >
      <LoaderCircle
        class="size-5 animate-spin text-accent"
        aria-hidden="true"
      />
      正在准备你的媒体库…
    </div>
  </RouterView>
</template>

<style>
html {
  /* 提示 UA 使用对应配色绘制滚动条等，减少主题切换时的额外重绘 */
  color-scheme: light dark;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  isolation: isolate;
  transform: translateZ(0);
  backface-visibility: hidden;
}
</style>
