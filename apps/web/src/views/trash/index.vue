<script setup lang="ts">
import { translate } from "@/i18n";
import { onBeforeUnmount, ref } from "vue";
import { ShieldAlert, Trash2 } from "lucide-vue-next";
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
      workspace.notify(translate("回收站已经是空的"), "info");
      return;
    }
    if (
      !(await workspace.confirm({
        title: translate("清空回收站？"),
        message: translate(
          "将永久删除当前回收站中的 {value1} 项媒体。此操作不可恢复，确认后分批删除；操作期间新移入的媒体不会被删除。",
          { value1: ids.length },
        ),
        confirmLabel: translate("永久删除 {value1} 项", { value1: ids.length }),
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
        ? translate(
            "已删除 {value1} 项记录，{value2} 个存储对象需管理员查看日志后清理。",
            { value1: deletedCount.value, value2: cleanupPending },
          )
        : translate("已永久删除 {value1} 项媒体", {
            value1: deletedCount.value,
          }),
      cleanupPending ? "info" : "success",
    );
  } catch (error) {
    if (!controller.signal.aborted)
      workspace.notify(
        translate(
          "已删除 {value1} 项；{value2}。请刷新后检查剩余媒体。{value3}",
          {
            value1: deletedCount.value,
            value2: getErrorMessage(error),
            value3: cleanupPending
              ? translate("另有 {value1} 个存储对象需管理员清理。", {
                  value1: cleanupPending,
                })
              : "",
          },
        ),
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
      :title="$t('回收站')"
      :description="
        $t('{value1}误删的照片，仍可在这里找回', {
          value1: workspace.overview
            ? $t('{value1} 项媒体 · ', { value1: workspace.overview.trash })
            : '',
        })
      "
      ><ViewToggle /><el-button
        type="danger"
        plain
        :loading="clearing"
        native-type="button"
        :disabled="
          clearing ||
          !workspace.can('asset:delete') ||
          workspace.overview?.trash === 0
        "
        @click="emptyTrash"
      >
        <Trash2 v-if="!clearing" />{{
          clearing
            ? $t("正在处理 · 已删除 {value1}", { value1: deletedCount })
            : $t("清空回收站")
        }}
      </el-button></PageHeader
    >
    <div
      class="mx-4 mb-4 flex gap-3 rounded-xl border border-warn/20 bg-warn/5 p-4 sm:mx-6"
    >
      <ShieldAlert class="mt-0.5 size-4 shrink-0 text-warn" />
      <p class="text-xs leading-6 text-soft">
        {{
          $t(
            "恢复会保留收藏、相册与标签关联。永久删除无法撤销；当前未启用自动过期清理，回收站仍占用存储空间。",
          )
        }}
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
