<script setup lang="ts">
import { CircleCheck, Info, TriangleAlert, X } from "lucide-vue-next";
import { useWorkspaceStore } from "@/stores/workspace";
import AppModal from "./AppModal.vue";
const workspace = useWorkspaceStore();
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed right-4 bottom-5 left-4 z-[80] mx-auto flex max-w-md flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      <div
        v-for="notice in workspace.notices"
        :key="notice.id"
        class="mh-enter pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-panel2 p-4 shadow-xl"
        :role="notice.kind === 'error' ? 'alert' : 'status'"
      >
        <component
          :is="
            notice.kind === 'error'
              ? TriangleAlert
              : notice.kind === 'info'
                ? Info
                : CircleCheck
          "
          class="mt-0.5 size-4 shrink-0"
          :class="
            notice.kind === 'error'
              ? 'text-err'
              : notice.kind === 'info'
                ? 'text-ai'
                : 'text-ok'
          "
          aria-hidden="true"
        />
        <p class="min-w-0 flex-1 text-xs leading-5">{{ notice.message }}</p>
        <button
          type="button"
          class="shrink-0 text-faint hover:text-ghost"
          aria-label="关闭提示"
          @click="workspace.dismissNotice(notice.id)"
        >
          <X class="size-4" />
        </button>
      </div>
    </div>
  </Teleport>
  <AppModal
    :open="Boolean(workspace.confirmation)"
    :title="workspace.confirmation?.title ?? '请确认'"
    @update:open="workspace.answerConfirmation(false)"
  >
    <div class="p-5">
      <p class="whitespace-pre-line text-sm leading-7 text-soft">
        {{ workspace.confirmation?.message }}
      </p>
      <div class="mt-6 flex justify-end gap-2">
        <button
          class="mh-button"
          type="button"
          autofocus
          @click="workspace.answerConfirmation(false)"
        >
          取消
        </button>
        <button
          class="mh-button"
          :class="
            workspace.confirmation?.danger
              ? 'mh-button-danger'
              : 'mh-button-primary'
          "
          type="button"
          @click="workspace.answerConfirmation(true)"
        >
          {{ workspace.confirmation?.confirmLabel ?? "确认" }}
        </button>
      </div>
    </div>
  </AppModal>
</template>
