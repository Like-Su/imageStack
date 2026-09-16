<script setup lang="ts">
import { computed } from "vue";
import { ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-vue-next";
import { usePreferencesStore } from "@/stores/preferences";
import type { AssetSortBy } from "@/types/media";

defineProps<{ disabled?: boolean }>();
const preferences = usePreferencesStore();
const directionLabel = computed(() => {
  const ascending = preferences.values.assetSortOrder === "asc";
  if (preferences.values.assetSortBy === "name")
    return ascending ? "文件名升序" : "文件名降序";
  if (preferences.values.assetSortBy === "size")
    return ascending ? "小文件优先" : "大文件优先";
  return ascending ? "最早上传优先" : "最新上传优先";
});

function changeSort(value: AssetSortBy) {
  preferences.values.assetSortBy = value;
  preferences.values.assetSortOrder = value === "name" ? "asc" : "desc";
}

function toggleDirection() {
  preferences.values.assetSortOrder =
    preferences.values.assetSortOrder === "asc" ? "desc" : "asc";
}
</script>

<template>
  <div class="flex shrink-0 items-center gap-1" :aria-label="$t('资源排序')">
    <el-select
      :model-value="preferences.values.assetSortBy"
      class="!w-28 sm:!w-32"
      :disabled="disabled"
      :aria-label="$t('资源排序')"
      @update:model-value="changeSort"
    >
      <el-option :label="$t('上传时间')" value="createdAt" />
      <el-option :label="$t('文件名称')" value="name" />
      <el-option :label="$t('文件大小')" value="size" />
    </el-select>
    <el-button
      text
      circle
      native-type="button"
      :disabled="disabled"
      :title="$t(directionLabel)"
      :aria-label="$t('切换排序方向：{value1}', { value1: $t(directionLabel) })"
      @click="toggleDirection"
    >
      <ArrowUpWideNarrow v-if="preferences.values.assetSortOrder === 'asc'" />
      <ArrowDownWideNarrow v-else />
    </el-button>
  </div>
</template>
