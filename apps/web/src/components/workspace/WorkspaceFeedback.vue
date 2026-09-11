<script setup lang="ts">
import { useWorkspaceStore } from "@/stores/workspace";
import AppModal from "./AppModal.vue";
const workspace = useWorkspaceStore();
</script>

<template>
  <AppModal
    :open="Boolean(workspace.confirmation)"
    :title="workspace.confirmation?.title ?? $t('请确认')"
    @update:open="workspace.answerConfirmation(false)"
  >
    <div class="p-5">
      <p class="whitespace-pre-line text-sm leading-7 text-soft">
        {{ workspace.confirmation?.message }}
      </p>
      <div class="mt-6 flex justify-end gap-2">
        <el-button autofocus @click="workspace.answerConfirmation(false)">
          {{ $t("取消") }}
        </el-button>
        <el-button
          :type="workspace.confirmation?.danger ? 'danger' : 'primary'"
          @click="workspace.answerConfirmation(true)"
        >
          {{ workspace.confirmation?.confirmLabel ?? $t("确认") }}
        </el-button>
      </div>
    </div>
  </AppModal>
</template>
