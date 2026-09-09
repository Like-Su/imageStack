<script setup lang="ts">
import type { Component } from "vue";
import {
  Images,
  LoaderCircle,
  TriangleAlert,
  RefreshCw,
} from "lucide-vue-next";
defineProps<{
  loading?: boolean;
  error?: string;
  title?: string;
  description?: string;
  icon?: Component;
}>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    class="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center"
    :role="error ? 'alert' : 'status'"
    :aria-busy="loading"
  >
    <span
      class="mb-5 grid size-16 place-items-center rounded-2xl border border-line bg-panel2"
      :class="error ? 'text-err' : 'text-faint'"
    >
      <LoaderCircle
        v-if="loading"
        class="size-6 animate-spin text-accent"
        aria-hidden="true"
      />
      <component
        :is="error ? TriangleAlert : (icon ?? Images)"
        v-else
        class="size-7"
        aria-hidden="true"
      />
    </span>
    <h2 class="text-base font-medium">
      {{
        loading
          ? "正在加载…"
          : error
            ? "暂时无法加载"
            : (title ?? "这里还没有媒体")
      }}
    </h2>
    <p class="mt-2 max-w-md text-[13px] leading-6 text-soft">
      {{ loading ? "正在从你的媒体库获取数据" : error || description }}
    </p>
    <button
      v-if="error"
      class="mh-button mt-5"
      type="button"
      @click="$emit('retry')"
    >
      <RefreshCw />重新加载
    </button>
    <div v-else-if="!loading && $slots.default" class="mt-5"><slot /></div>
  </div>
</template>
