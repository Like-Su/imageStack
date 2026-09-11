<script setup lang="ts">
import { Grid2X2, List } from "lucide-vue-next";
import { usePreferencesStore } from "@/stores/preferences";
import { computed } from "vue";
import { translate } from "@/i18n";
const preferences = usePreferencesStore();
const options = computed(() => [
  { value: "grid", label: translate("瀑布流视图"), icon: Grid2X2 },
  { value: "list", label: translate("列表视图"), icon: List },
]);
</script>

<template>
  <el-segmented
    v-model="preferences.values.viewMode"
    :options="options"
    :aria-label="$t('显示方式')"
  >
    <template #default="{ item }">
      <component :is="item.icon" class="size-4" :aria-label="item.label" />
    </template>
  </el-segmented>
</template>
