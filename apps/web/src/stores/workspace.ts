import { translate } from "@/i18n";
import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { ElMessage } from "element-plus";
import { mediaApi } from "@/api/media";
import {
  invalidateCollectionCache,
  updateCollectionCache,
} from "@/api/collectionCache";
import { clearSharedReads } from "@/api/sharedRead";
import { ApiError, getErrorMessage } from "@/api/request";
import { useAuthStore } from "./auth";
import { updateAsset, updateAssetDetail } from "@/composables/workspaceUpdates";
import { clearThumbnailCache } from "@/composables/thumbnailCache";
import type {
  Album,
  AssetDetail,
  AssetSummary,
  AssetTagBatch,
  LibraryOverview,
  Tag,
} from "@/types/media";
import type { WorkspaceChange, WorkspaceResource } from "@/types/workspace";
import type { AdminRecord } from "@/types/iam";

type NoticeKind = "success" | "error" | "info";
interface Confirmation {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export const useWorkspaceStore = defineStore("workspace", () => {
  const auth = useAuthStore();
  const overview = shallowRef<LibraryOverview | null>(null);
  const overviewError = ref("");
  const selectedAsset = shallowRef<AssetSummary | null>(null);
  const confirmation = shallowRef<Confirmation | null>(null);
  const favoriteBusy = ref(new Set<string>());
  const pendingTasks = computed(() =>
    overview.value
      ? overview.value.statuses.PENDING + overview.value.statuses.PROCESSING
      : 0,
  );
  let overviewController: AbortController | null = null;
  let overviewPromise: Promise<void> | null = null;
  let overviewLoadedAt = 0;
  let confirmationResolve: ((answer: boolean) => void) | null = null;
  const assets = new Map<string, AssetSummary>();
  const assetAlbums = new Map<string, Set<string>>();
  const listeners = new Set<(change: WorkspaceChange) => void>();
  const invalidationListeners = new Set<
    (resources: Set<WorkspaceResource>, lazy: boolean) => void
  >();
  const invalidated = new Set<WorkspaceResource>();
  let invalidationTimer: number | undefined;
  let changeBatchDepth = 0;

  function can(permission: string) {
    return (
      auth.user?.roleCode === "ROLE_ADMIN" ||
      Boolean(auth.user?.permissions.includes(permission))
    );
  }

  function notify(message: string, kind: NoticeKind = "success") {
    ElMessage({
      message,
      type: kind,
      showClose: true,
      duration: kind === "error" ? 9000 : 4500,
    });
  }

  function loadOverview(force = false): Promise<void> {
    if (!can("asset:list")) return Promise.resolve();
    if (overviewPromise && !force) return overviewPromise;
    if (!force && overview.value && Date.now() - overviewLoadedAt < 5000)
      return Promise.resolve();
    overviewController?.abort();
    const controller = new AbortController();
    overviewController = controller;
    const pending = (async () => {
      try {
        const result = await mediaApi.overview(controller.signal);
        if (controller.signal.aborted) return;
        overview.value = result;
        overviewLoadedAt = Date.now();
        overviewError.value = "";
      } catch (error) {
        if (!controller.signal.aborted)
          overviewError.value = getErrorMessage(error);
      } finally {
        if (overviewController === controller) overviewPromise = null;
      }
    })();
    overviewPromise = pending;
    return pending;
  }

  function onChange(listener: (change: WorkspaceChange) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function onInvalidate(
    listener: (resources: Set<WorkspaceResource>, lazy: boolean) => void,
  ) {
    invalidationListeners.add(listener);
    return () => {
      invalidationListeners.delete(listener);
    };
  }

  function invalidate(resources: WorkspaceResource[], lazy = false) {
    invalidateCollectionCache(resources);
    if (resources.includes("overview")) overviewLoadedAt = 0;
    if (lazy) {
      for (const listener of invalidationListeners)
        listener(new Set(resources), true);
      return;
    }
    for (const resource of resources) invalidated.add(resource);
    window.clearTimeout(invalidationTimer);
    if (changeBatchDepth) return;
    invalidationTimer = window.setTimeout(() => {
      const pending = new Set(invalidated);
      invalidated.clear();
      for (const listener of invalidationListeners) listener(pending, false);
      if (pending.has("overview")) void loadOverview(true);
    }, 150);
  }

  function beginChanges() {
    changeBatchDepth += 1;
  }

  function endChanges() {
    changeBatchDepth = Math.max(0, changeBatchDepth - 1);
    if (!changeBatchDepth && invalidated.size) invalidate([...invalidated]);
  }

  function rememberAssets(items: AssetSummary[], albumId?: string) {
    for (const asset of items) {
      assets.delete(asset.id);
      assets.set(asset.id, asset);
      if ("albums" in asset && Array.isArray(asset.albums))
        assetAlbums.set(
          asset.id,
          new Set((asset as AssetDetail).albums.map((album) => album.id)),
        );
      else if (albumId) {
        const memberships = assetAlbums.get(asset.id) ?? new Set<string>();
        memberships.add(albumId);
        assetAlbums.set(asset.id, memberships);
      }
    }
    while (assets.size > 2000) {
      const id = assets.keys().next().value!;
      assets.delete(id);
      assetAlbums.delete(id);
    }
  }

  function knownAssets(ids: string[]) {
    return ids.flatMap((id) => (assets.has(id) ? [assets.get(id)!] : []));
  }

  function publish(change: WorkspaceChange) {
    updateCollectionCache(change);
    if (change.type === "admin") {
      for (const listener of listeners) listener(change);
      return;
    }
    if (change.type === "album-members") {
      for (const id of change.ids) {
        if (!assets.has(id)) continue;
        const memberships = assetAlbums.get(id) ?? new Set<string>();
        if (change.added) memberships.add(change.album.id);
        else memberships.delete(change.album.id);
        assetAlbums.set(id, memberships);
      }
    }
    if (change.type === "album" && !change.value)
      for (const memberships of assetAlbums.values())
        memberships.delete(change.id);
    for (const [id, asset] of assets) {
      if (change.type === "assets" && change.removed && change.ids.includes(id))
        assets.delete(id);
      else
        assets.set(
          id,
          "albums" in asset
            ? (updateAssetDetail(asset as AssetDetail, change) ?? asset)
            : updateAsset(asset, change),
        );
    }
    if (selectedAsset.value) {
      if (
        change.type === "assets" &&
        (change.removed || change.patch.deleted !== undefined) &&
        change.ids.includes(selectedAsset.value.id)
      )
        selectedAsset.value = null;
      else selectedAsset.value = updateAsset(selectedAsset.value, change);
    }
    for (const listener of listeners) listener(change);
  }

  function changeOverview(
    update: (current: LibraryOverview) => LibraryOverview,
  ) {
    if (!overview.value) return;
    overviewController?.abort();
    overviewPromise = null;
    overviewLoadedAt = Date.now();
    overview.value = update(overview.value);
  }

  function updateAssets(
    ids: string[],
    patch: Partial<AssetDetail>,
    removed = false,
  ) {
    const before = knownAssets(ids);
    changeOverview((current) => {
      const next = { ...current, statuses: { ...current.statuses } };
      for (const previous of before) {
        const updated = removed ? null : { ...previous, ...patch };
        for (const [asset, direction] of [
          [previous, -1],
          [updated, 1],
        ] as const) {
          if (!asset) continue;
          const countKey = asset.deleted ? "trash" : "total";
          const bytesKey = asset.deleted ? "trashBytes" : "bytes";
          next[countKey] += direction;
          next[bytesKey] = (
            BigInt(next[bytesKey]) +
            BigInt(asset.size ?? 0) * BigInt(direction)
          ).toString();
          if (!asset.deleted) {
            next.statuses[asset.status] += direction;
            if (asset.isFavorite) next.favorites += direction;
          }
        }
      }
      next.total = Math.max(0, next.total);
      next.trash = Math.max(0, next.trash);
      next.favorites = Math.max(0, next.favorites);
      for (const status of Object.keys(
        next.statuses,
      ) as (keyof typeof next.statuses)[])
        next.statuses[status] = Math.max(0, next.statuses[status]);
      next.bytes = (
        BigInt(next.bytes) < 0n ? 0n : BigInt(next.bytes)
      ).toString();
      next.trashBytes = (
        BigInt(next.trashBytes) < 0n ? 0n : BigInt(next.trashBytes)
      ).toString();
      return next;
    });
    const albumIds = Object.fromEntries(
      ids.map((id) => [id, [...(assetAlbums.get(id) ?? [])]]),
    );
    publish({ type: "assets", ids, patch, before, albumIds, removed });
    if (removed) for (const id of ids) assetAlbums.delete(id);
    if (removed || patch.deleted !== undefined)
      invalidate(["albums", "tags", "places", "ai"], true);
    if (before.length !== ids.length) invalidate(["overview"]);
  }

  function updateAlbum(album: Album, created = false) {
    if (created)
      changeOverview((current) => ({ ...current, albums: current.albums + 1 }));
    publish({ type: "album", id: album.id, value: album });
  }

  function deleteAlbum(id: string) {
    changeOverview((current) => ({
      ...current,
      albums: Math.max(0, current.albums - 1),
    }));
    publish({ type: "album", id, value: null });
  }

  function updateAlbumMembers(album: Album, ids: string[], added: boolean) {
    publish({ type: "album-members", album, ids, added });
  }

  function updateTag(tag: Tag, created = false, previousId = tag.id) {
    if (created || previousId !== tag.id)
      changeOverview((current) => ({
        ...current,
        tags: Math.max(0, current.tags + (created ? 1 : -1)),
      }));
    publish({ type: "tag", id: previousId, value: tag });
  }

  function deleteTag(id: string) {
    changeOverview((current) => ({
      ...current,
      tags: Math.max(0, current.tags - 1),
    }));
    publish({ type: "tag", id, value: null });
  }

  function updateAssetTags(
    id: string,
    tags: Tag[],
    createdCount = 0,
    removedTagId?: string,
  ) {
    if (createdCount)
      changeOverview((current) => ({
        ...current,
        tags: current.tags + createdCount,
      }));
    publish({ type: "asset-tags", id, tags, removedTagId });
  }

  function updateAdmin(before: AdminRecord | null, value: AdminRecord | null) {
    publish({ type: "admin", before, value });
  }

  function applyTagBatch(result: AssetTagBatch) {
    const tags = new Map(result.tags.map((tag) => [tag.id, tag]));
    if (result.createdCount)
      changeOverview((current) => ({
        ...current,
        tags: current.tags + result.createdCount,
      }));
    publish({
      type: "asset-tags-batch",
      ids: result.assets.map((asset) => asset.id),
      tags: result.tags,
      assignments: Object.fromEntries(
        result.assets.map((asset) => [
          asset.id,
          asset.tagIds.flatMap((id) => (tags.has(id) ? [tags.get(id)!] : [])),
        ]),
      ),
    });
  }

  function removeAssetsTag(ids: string[], tag: Tag) {
    publish({
      type: "asset-tags-batch",
      ids,
      tags: [tag],
      removedTagId: tag.id,
    });
  }

  function confirm(options: Confirmation) {
    confirmationResolve?.(false);
    confirmation.value = options;
    return new Promise<boolean>((resolve) => {
      confirmationResolve = resolve;
    });
  }

  function answerConfirmation(answer: boolean) {
    confirmation.value = null;
    confirmationResolve?.(answer);
    confirmationResolve = null;
  }

  async function perform<Result>(
    action: () => Promise<Result>,
    message: string | ((result: Result) => string),
    update: (result: Result) => void,
  ) {
    const sessionVersion = auth.getSessionVersion();
    try {
      const result = await action();
      if (sessionVersion !== auth.getSessionVersion()) return false;
      update(result);
      notify(typeof message === "function" ? message(result) : message);
      return true;
    } catch (error) {
      if (
        sessionVersion === auth.getSessionVersion() &&
        !(
          error instanceof ApiError &&
          ["AUTH_CHANGED", "ABORTED"].includes(error.code)
        )
      )
        notify(getErrorMessage(error), "error");
      return false;
    }
  }

  async function toggleFavorite(asset: AssetSummary) {
    if (favoriteBusy.value.has(asset.id) || !can("asset:edit")) return;
    favoriteBusy.value.add(asset.id);
    rememberAssets([asset]);
    const favorite = !asset.isFavorite;
    try {
      await perform(
        () => mediaApi.favorite(asset.id, favorite),
        favorite ? translate("已加入收藏") : translate("已取消收藏"),
        (result) =>
          updateAssets([result.id], { isFavorite: result.isFavorite }),
      );
    } finally {
      favoriteBusy.value.delete(asset.id);
    }
  }

  function reset() {
    invalidateCollectionCache(["albums", "tags"]);
    clearSharedReads();
    clearThumbnailCache();
    overviewController?.abort();
    overviewPromise = null;
    overviewLoadedAt = 0;
    window.clearTimeout(invalidationTimer);
    invalidated.clear();
    changeBatchDepth = 0;
    assets.clear();
    assetAlbums.clear();
    overview.value = null;
    overviewError.value = "";
    selectedAsset.value = null;
    favoriteBusy.value.clear();
    answerConfirmation(false);
    ElMessage.closeAll();
  }

  return {
    overview,
    overviewError,
    selectedAsset,
    confirmation,
    favoriteBusy,
    pendingTasks,
    can,
    notify,
    loadOverview,
    invalidate,
    beginChanges,
    endChanges,
    onChange,
    onInvalidate,
    rememberAssets,
    knownAssets,
    updateAssets,
    updateAlbum,
    deleteAlbum,
    updateAlbumMembers,
    updateTag,
    deleteTag,
    updateAssetTags,
    applyTagBatch,
    removeAssetsTag,
    updateAdmin,
    confirm,
    answerConfirmation,
    perform,
    toggleFavorite,
    reset,
  };
});
