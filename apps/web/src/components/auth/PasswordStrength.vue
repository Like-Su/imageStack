<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ password: string }>();

const score = computed(() => {
  if (!props.password) return 0;
  if (props.password.length < 8) return 1;
  return (
    1 +
    Number(/[a-z]/.test(props.password) && /[A-Z]/.test(props.password)) +
    Number(/\d/.test(props.password)) +
    Number(/[^A-Za-z0-9]/.test(props.password))
  );
});

const label = computed(
  () => ["", "太弱", "一般", "较强", "非常强"][score.value],
);
</script>

<template>
  <div class="mt-2">
    <div
      role="meter"
      aria-label="密码强度"
      :aria-valuenow="score"
      :aria-valuetext="label || '尚未输入密码'"
      aria-valuemin="0"
      aria-valuemax="4"
      class="flex gap-1"
    >
      <span
        v-for="segment in 4"
        :key="segment"
        class="h-1 flex-1 rounded-full transition-colors"
        :class="
          segment > score
            ? 'bg-panel3'
            : score === 1
              ? 'bg-err'
              : score === 4
                ? 'bg-ok'
                : 'bg-warn'
        "
      ></span>
    </div>
    <p
      class="mt-1 text-[11px]"
      :class="
        !score
          ? 'text-faint'
          : score === 1
            ? 'text-err'
            : score === 4
              ? 'text-ok'
              : 'text-warn'
      "
    >
      {{ password ? `密码强度：${label}` : "使用字母、数字与符号增强强度" }}
    </p>
  </div>
</template>
