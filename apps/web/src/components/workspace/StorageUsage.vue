<script setup lang="ts">
import { computed } from "vue";
import { HardDrive, LoaderCircle } from "lucide-vue-next";
import { formatBytes } from "@/composables/mediaFormat";
import { useWorkspaceStore } from "@/stores/workspace";

const workspace = useWorkspaceStore();
const percentage = computed(() => {
  const total = Number(workspace.storageSpace?.totalBytes);
  const used = Number(workspace.storageSpace?.usedBytes);
  if (!Number.isFinite(total) || !Number.isFinite(used) || total <= 0)
    return null;
  return Math.min(100, Math.max(0, (used / total) * 100));
});
</script>

<template>
  <div
    class="rounded-xl bg-panel2 p-3"
    :aria-busy="workspace.storageLoading"
    data-storage-usage
  >
    <div class="flex items-center justify-between gap-2 text-[11px] text-soft">
      <span class="flex items-center gap-1.5">
        <HardDrive class="size-3.5" aria-hidden="true" />{{ $t("存储空间") }}
      </span>
      <LoaderCircle
        v-if="workspace.storageLoading"
        class="size-3.5 animate-spin motion-reduce:animate-none"
        :aria-label="$t('正在加载…')"
      />
      <span v-else class="text-[10px] text-faint">{{
        $t("已用 / 总容量")
      }}</span>
    </div>
    <p class="mt-2 flex flex-wrap items-baseline gap-x-1 text-xs tabular-nums">
      <span class="font-medium">{{
        formatBytes(workspace.storageSpace?.usedBytes)
      }}</span>
      <span class="text-faint">/</span>
      <span class="text-soft">{{
        workspace.storageSpace?.totalBytes === null
          ? $t("未配置")
          : formatBytes(workspace.storageSpace?.totalBytes)
      }}</span>
    </p>
    <el-progress
      v-if="percentage !== null"
      class="mt-2"
      :percentage="percentage"
      :stroke-width="6"
      :show-text="false"
      :color="percentage >= 90 ? 'var(--app-warn)' : 'var(--app-accent)'"
      :aria-label="$t('存储空间使用率')"
    />
    <p
      v-if="workspace.storageSpace"
      class="mt-2 text-[10px] leading-5 text-faint"
    >
      {{
        workspace.storageSpace.scope === "filesystem"
          ? $t("存储磁盘 · 含其他应用数据")
          : $t("当前存储桶 · 含原文件与派生文件")
      }}
      <template v-if="workspace.storageSpace.availableBytes !== null">
        <br />{{
          $t("剩余可用：{value1}", {
            value1: formatBytes(workspace.storageSpace.availableBytes),
          })
        }}
      </template>
      <template v-else> <br />{{ $t("总容量需由管理员配置") }} </template>
    </p>
    <el-button
      v-if="workspace.storageError"
      link
      type="danger"
      size="small"
      native-type="button"
      :title="workspace.storageError"
      :disabled="workspace.storageLoading"
      @click="workspace.loadStorage(true)"
    >
      {{ $t("统计获取失败，点击重试") }}
    </el-button>
  </div>
</template>
