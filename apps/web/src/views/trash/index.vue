<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { LoaderCircle, ShieldAlert, Trash2 } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useWorkspaceStore } from "@/stores/workspace";
import PageHeader from "@/components/workspace/PageHeader.vue";
import AssetBrowser from "@/components/media/AssetBrowser.vue";
import ViewToggle from "@/components/media/ViewToggle.vue";

const workspace = useWorkspaceStore();
const clearing = ref(false);
const deletedCount = ref(0);
const controller = new AbortController();

async function emptyTrash() {
  if (clearing.value || !workspace.can("asset:delete")) return;
  clearing.value = true;
  deletedCount.value = 0;
  let cleanupPending = 0;
  try {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await mediaApi.assets(
        { limit: 100, cursor },
        controller.signal,
        true,
      );
      ids.push(...page.items.map((asset) => asset.id));
      cursor = page.hasMore ? (page.nextCursor ?? undefined) : undefined;
    } while (cursor && !controller.signal.aborted);
    if (!ids.length) {
      workspace.notify("回收站已经是空的", "info");
      return;
    }
    if (
      !(await workspace.confirm({
        title: "清空回收站？",
        message: `将永久删除当前回收站中的 ${ids.length} 项媒体。此操作不可恢复，确认后分批删除；操作期间新移入的媒体不会被删除。`,
        confirmLabel: `永久删除 ${ids.length} 项`,
        danger: true,
      }))
    )
      return;
    for (let offset = 0; offset < ids.length; offset += 100) {
      if (controller.signal.aborted) return;
      const result = await mediaApi.purge(ids.slice(offset, offset + 100));
      deletedCount.value += result.count;
      cleanupPending += result.cleanupPending;
    }
    workspace.notify(
      cleanupPending
        ? `已删除 ${deletedCount.value} 项记录，${cleanupPending} 个存储对象需管理员查看日志后清理。`
        : `已永久删除 ${deletedCount.value} 项媒体`,
      cleanupPending ? "info" : "success",
    );
  } catch (error) {
    if (!controller.signal.aborted)
      workspace.notify(
        `已删除 ${deletedCount.value} 项；${getErrorMessage(error)}。请刷新后检查剩余媒体。${cleanupPending ? `另有 ${cleanupPending} 个存储对象需管理员清理。` : ""}`,
        "error",
      );
  } finally {
    clearing.value = false;
    if (!controller.signal.aborted) workspace.invalidate();
  }
}
onBeforeUnmount(() => controller.abort());
</script>

<template>
  <section>
    <PageHeader
      title="回收站"
      :description="`${workspace.overview ? `${workspace.overview.trash} 项媒体 · ` : ''}误删的照片，仍可在这里找回`"
      ><ViewToggle /><button
        type="button"
        class="mh-button mh-button-danger"
        :disabled="
          clearing ||
          !workspace.can('asset:delete') ||
          workspace.overview?.trash === 0
        "
        @click="emptyTrash"
      >
        <LoaderCircle v-if="clearing" class="animate-spin" /><Trash2 v-else />{{
          clearing ? `正在处理 · 已删除 ${deletedCount}` : "清空回收站"
        }}
      </button></PageHeader
    >
    <div
      class="mx-4 mb-4 flex gap-3 rounded-xl border border-warn/20 bg-warn/5 p-4 sm:mx-6"
    >
      <ShieldAlert class="mt-0.5 size-4 shrink-0 text-warn" />
      <p class="text-xs leading-6 text-soft">
        恢复会保留收藏、相册与标签关联。永久删除无法撤销；当前未启用自动过期清理，回收站仍占用存储空间。
      </p>
    </div>
    <div :inert="clearing || undefined">
      <AssetBrowser
        trash
        empty-title="回收站很干净"
        empty-description="移入回收站的媒体会显示在这里，你可以恢复或永久删除。"
      />
    </div>
  </section>
</template>
