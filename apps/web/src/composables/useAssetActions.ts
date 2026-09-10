import { onScopeDispose, ref } from "vue";
import { mediaApi, mediaStreamUrl } from "@/api/media";
import { ApiError, getErrorMessage } from "@/api/request";
import { useWorkspaceStore } from "@/stores/workspace";
import type { AssetSummary } from "@/types/media";

export function useAssetActions() {
  const workspace = useWorkspaceStore();
  const busy = ref(false);
  const downloading = ref(false);
  let downloadController: AbortController | null = null;
  const urls = new Set<string>();

  function closeDeleted(ids: string[]) {
    if (workspace.selectedAsset && ids.includes(workspace.selectedAsset.id))
      workspace.selectedAsset = null;
  }

  async function moveToTrash(ids: string[]) {
    if (busy.value || !ids.length || !workspace.can("asset:delete"))
      return false;
    busy.value = true;
    try {
      if (
        !(await workspace.confirm({
          title: "移入回收站？",
          message: `将选中的 ${ids.length} 项媒体移入回收站，可在回收站中恢复。`,
          confirmLabel: "移入回收站",
          danger: true,
        }))
      )
        return false;
      const success = await workspace.perform(
        () => mediaApi.trash(ids),
        (result) => `已将 ${result.count} 项媒体移入回收站`,
      );
      if (success) closeDeleted(ids);
      return success;
    } finally {
      busy.value = false;
    }
  }

  async function restore(ids: string[]) {
    if (busy.value || !ids.length || !workspace.can("asset:delete"))
      return false;
    busy.value = true;
    try {
      const success = await workspace.perform(
        () => mediaApi.restore(ids),
        (result) => `已恢复 ${result.count} 项媒体`,
      );
      if (success) closeDeleted(ids);
      return success;
    } finally {
      busy.value = false;
    }
  }

  async function purge(ids: string[]) {
    if (busy.value || !ids.length || !workspace.can("asset:delete"))
      return false;
    busy.value = true;
    try {
      if (
        !(await workspace.confirm({
          title: "永久删除媒体？",
          message: `将永久删除选中的 ${ids.length} 项媒体及其相册、标签关联。此操作不可恢复，请确认已有必要备份。`,
          confirmLabel: "永久删除",
          danger: true,
        }))
      )
        return false;
      const result = await mediaApi.purge(ids);
      closeDeleted(ids);
      workspace.invalidate();
      workspace.notify(
        result.cleanupPending
          ? `已删除 ${result.count} 项记录；${result.cleanupPending} 个存储对象清理失败，请管理员查看服务器日志。`
          : `已永久删除 ${result.count} 项媒体`,
        result.cleanupPending ? "info" : "success",
      );
      return true;
    } catch (error) {
      workspace.notify(getErrorMessage(error), "error");
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function download(asset: AssetSummary, originalBlob?: Blob) {
    if (downloading.value || !workspace.can("asset:download")) return;
    downloading.value = true;
    downloadController = new AbortController();
    try {
      const url = originalBlob
        ? URL.createObjectURL(originalBlob)
        : mediaStreamUrl(
            (
              await mediaApi.streamTicket(
                asset.id,
                "download",
                downloadController.signal,
              )
            ).path,
          );
      if (originalBlob) urls.add(url);
      const link = document.createElement("a");
      link.href = url;
      link.download = asset.name;
      link.rel = "noreferrer";
      link.referrerPolicy = "no-referrer";
      document.body.append(link);
      link.click();
      link.remove();
      if (originalBlob) {
        window.setTimeout(() => {
          URL.revokeObjectURL(url);
          urls.delete(url);
        }, 30_000);
      } else {
        workspace.notify(
          "已交给浏览器流式下载，可在浏览器下载列表查看进度。",
          "info",
        );
      }
    } catch (error) {
      if (!(error instanceof ApiError && error.code === "ABORTED"))
        workspace.notify(getErrorMessage(error), "error");
    } finally {
      downloading.value = false;
    }
  }

  onScopeDispose(() => {
    downloadController?.abort();
    for (const url of urls) URL.revokeObjectURL(url);
  });
  return { busy, downloading, moveToTrash, restore, purge, download };
}
