<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  checked?: boolean;
  disabled?: boolean;
}>();
defineEmits<{ change: [checked: boolean] }>();
</script>

<template>
  <div
    class="flex items-center justify-between gap-5 border-b border-line py-4 last:border-0"
  >
    <div>
      <h3 class="text-sm">{{ title }}</h3>
      <p class="mt-1 text-xs leading-6 text-soft">{{ description }}</p>
    </div>
    <button
      type="button"
      class="mh-switch"
      role="switch"
      :aria-checked="Boolean(checked)"
      :aria-label="title"
      :disabled="disabled"
      @click="$emit('change', !checked)"
    />
  </div>
</template>
