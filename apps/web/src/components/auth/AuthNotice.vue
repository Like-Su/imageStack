<script setup lang="ts">
import { CircleAlert, CircleCheck, Info } from "lucide-vue-next";

withDefaults(
  defineProps<{
    message?: string;
    variant?: "error" | "success" | "info";
  }>(),
  { message: "", variant: "error" },
);
</script>

<template>
  <div
    v-if="message || $slots.default"
    :role="variant === 'error' ? 'alert' : 'status'"
    :aria-live="variant === 'error' ? 'assertive' : 'polite'"
    class="flex items-start gap-2.5 rounded-xl border p-3 text-[12.5px] leading-relaxed"
    :class="{
      'border-err/25 bg-err/8 text-err': variant === 'error',
      'border-ok/25 bg-ok/8 text-ok': variant === 'success',
      'border-line bg-panel2 text-soft': variant === 'info',
    }"
  >
    <component
      :is="
        variant === 'error'
          ? CircleAlert
          : variant === 'success'
            ? CircleCheck
            : Info
      "
      class="mt-0.5 size-4 shrink-0"
      aria-hidden="true"
    />
    <div class="min-w-0 break-words">
      <slot>{{ message }}</slot>
    </div>
  </div>
</template>
