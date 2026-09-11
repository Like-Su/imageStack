<script setup lang="ts">
import type { Component } from "vue";
import {
  Images,
  LoaderCircle,
  TriangleAlert,
  RefreshCw,
} from "lucide-vue-next";
defineProps<{
  loading?: boolean;
  error?: string;
  title?: string;
  description?: string;
  icon?: Component;
}>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <el-result
    class="min-h-64"
    :title="
      loading
        ? $t('正在加载…')
        : error
          ? $t('暂时无法加载')
          : (title ?? $t('这里还没有媒体'))
    "
    :sub-title="loading ? $t('正在从你的媒体库获取数据') : error || description"
    :role="error ? 'alert' : 'status'"
    :aria-busy="loading"
  >
    <template #icon>
      <el-icon
        :size="40"
        :color="error ? 'var(--app-err)' : 'var(--app-accent)'"
      >
        <LoaderCircle v-if="loading" class="animate-spin" aria-hidden="true" />
        <component
          v-else
          :is="error ? TriangleAlert : (icon ?? Images)"
          aria-hidden="true"
        />
      </el-icon>
    </template>
    <template #extra>
      <el-button v-if="error" :icon="RefreshCw" @click="$emit('retry')">{{
        $t("重新加载")
      }}</el-button>
      <slot v-else-if="!loading" />
    </template>
  </el-result>
</template>
