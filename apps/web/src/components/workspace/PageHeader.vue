<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <header
    class="flex flex-wrap items-end justify-between gap-4 px-4 pt-6 pb-4 sm:px-6"
  >
    <div class="min-w-0">
      <slot name="eyebrow" />
      <h1 class="font-display text-2xl font-bold tracking-tight">
        {{ title }}
      </h1>
      <p v-if="description" class="mt-1 text-sm leading-6 text-soft">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </header>
</template>
