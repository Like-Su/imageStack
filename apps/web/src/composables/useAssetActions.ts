import { translate } from "@/i18n";
import { onScopeDispose, ref } from "vue";
import { mediaApi, mediaStreamUrl } from "@/api/media";
import { ApiError, getErrorMessage } from "@/api/request";
import { useWorkspaceStore } from "@/stores/workspace";
import type { AssetSummary } from "@/types/media";

export function useAssetActions(source?: () => AssetSummary[]) {
  const workspace = useWorkspaceStore();
  const busy = ref(false);
  const downloading = ref(false);
  let downloadController: AbortController | null = null;
  const urls = new Set<string>();

  function remember(ids: string[]) {
    if (!source) return;
    const selected = new Set(ids);
    workspace.rememberAssets(
      source().filter((asset) => selected.has(asset.id)),
    );
  }

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
          title: translate("移入回收站？"),
          message: translate(
            "将选中的 {value1} 项媒体移入回收站，可在回收站中恢复。",
            { value1: ids.length },
          ),
          confirmLabel: translate("移入回收站"),
          danger: true,
        }))
      )
        return false;
      const success = await workspace.perform(
        () => mediaApi.trash(ids),
        (result) =>
          translate("已将 {value1} 项媒体移入回收站", { value1: result.count }),
        () => {
          remember(ids);
          workspace.updateAssets(ids, {
            deleted: true,
            deletedAt: new Date().toISOString(),
          });
        },
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
        (result) =>
          translate("已恢复 {value1} 项媒体", { value1: result.count }),
        () => {
          remember(ids);
          workspace.updateAssets(ids, { deleted: false, deletedAt: null });
        },
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
          title: translate("永久删除媒体？"),
          message: translate(
            "将永久删除选中的 {value1} 项媒体及其相册、标签关联。此操作不可恢复，请确认已有必要备份。",
            { value1: ids.length },
          ),
          confirmLabel: translate("永久删除"),
          danger: true,
        }))
      )
        return false;
      const result = await mediaApi.purge(ids);
      remember(ids);
      closeDeleted(ids);
      workspace.updateAssets(ids, {}, true);
      workspace.notify(
        result.cleanupPending
          ? translate(
              "已删除 {value1} 项记录；{value2} 个存储对象清理失败，请管理员查看服务器日志。",
              { value1: result.count, value2: result.cleanupPending },
            )
          : translate("已永久删除 {value1} 项媒体", { value1: result.count }),
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
          translate("已交给浏览器流式下载，可在浏览器下载列表查看进度。"),
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
