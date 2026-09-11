<script setup lang="ts">
import { translate } from "@/i18n";
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
  () =>
    [
      "",
      translate("太弱"),
      translate("一般"),
      translate("较强"),
      translate("非常强"),
    ][score.value],
);
</script>

<template>
  <div class="mt-2">
    <el-progress
      :percentage="score * 25"
      :show-text="false"
      :stroke-width="4"
      :color="
        score === 1
          ? 'var(--app-err)'
          : score === 4
            ? 'var(--app-ok)'
            : 'var(--app-warn)'
      "
      :aria-label="$t('密码强度')"
      :aria-valuetext="label || $t('尚未输入密码')"
    />
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
      {{
        password
          ? $t("密码强度：{value1}", { value1: label })
          : $t("使用字母、数字与符号增强强度")
      }}
    </p>
  </div>
</template>
