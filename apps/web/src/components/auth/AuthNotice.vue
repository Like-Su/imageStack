<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string;
    variant?: "error" | "success" | "info";
  }>(),
  { message: "", variant: "error" },
);
</script>

<template>
  <el-alert
    v-if="message || $slots.default"
    :role="variant === 'error' ? 'alert' : 'status'"
    :aria-live="variant === 'error' ? 'assertive' : 'polite'"
    :type="variant"
    :closable="false"
    show-icon
  >
    <slot>{{ message }}</slot>
  </el-alert>
</template>
