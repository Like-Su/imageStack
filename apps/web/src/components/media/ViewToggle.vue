<script setup lang="ts">
import { Grid2X2, List } from "lucide-vue-next";
import { usePreferencesStore } from "@/stores/preferences";
const preferences = usePreferencesStore();
</script>

<template>
  <div
    class="inline-flex shrink-0 rounded-lg border border-line bg-panel2 p-0.5"
    role="group"
    aria-label="显示方式"
  >
    <button
      v-for="mode in ['grid', 'list'] as const"
      :key="mode"
      type="button"
      class="grid size-7 place-items-center rounded-md"
      :class="
        preferences.values.viewMode === mode
          ? 'bg-panel3 text-ghost'
          : 'text-faint hover:text-soft'
      "
      :aria-label="mode === 'grid' ? '瀑布流视图' : '列表视图'"
      :aria-pressed="preferences.values.viewMode === mode"
      @click="preferences.values.viewMode = mode"
    >
      <component :is="mode === 'grid' ? Grid2X2 : List" class="size-4" />
    </button>
  </div>
</template>
