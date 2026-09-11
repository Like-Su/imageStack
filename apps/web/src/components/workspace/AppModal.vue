<script setup lang="ts">
import { ElDialog, ElDrawer } from "element-plus";

defineProps<{
  open: boolean;
  title: string;
  description?: string;
  busy?: boolean;
  drawer?: boolean;
}>();
defineEmits<{ "update:open": [open: boolean] }>();
</script>

<template>
  <component
    :is="drawer ? ElDrawer : ElDialog"
    :model-value="open"
    :title="title"
    class="mh-modal"
    width="min(480px, calc(100vw - 32px))"
    size="min(420px, 100vw)"
    append-to-body
    :close-on-click-modal="!busy"
    :close-on-press-escape="!busy"
    :show-close="!busy"
    @update:model-value="!busy && $emit('update:open', $event)"
  >
    <p v-if="description" class="px-5 pt-4 text-xs leading-5 text-soft">
      {{ description }}
    </p>
    <slot />
  </component>
</template>
