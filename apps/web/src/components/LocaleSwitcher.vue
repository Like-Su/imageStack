<script setup lang="ts">
import { ref } from "vue";
import { i18n, isAppLocale, localeOptions, setLocale } from "@/i18n";

const locale = i18n.global.locale;
const storageFailed = ref(false);

function changeLocale(value: unknown) {
  if (isAppLocale(value)) storageFailed.value = !setLocale(value);
}
</script>

<template>
  <div>
    <el-select
      :model-value="locale"
      :aria-label="$t('界面语言')"
      class="!w-36"
      @update:model-value="changeLocale"
    >
      <el-option
        v-for="option in localeOptions"
        :key="option.value"
        :label="option.label"
        :value="option.value"
      />
    </el-select>
    <p v-if="storageFailed" class="mt-2 text-xs text-warn" role="status">
      {{ $t("语言已切换，但浏览器无法保存此偏好。") }}
    </p>
  </div>
</template>
