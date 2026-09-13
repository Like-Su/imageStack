import {
  onActivated,
  onDeactivated,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
} from "vue";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useWorkspaceStore } from "@/stores/workspace";
import type { AssetQuery, AssetSummary } from "@/types/media";
import type { WorkspaceChange } from "@/types/workspace";
import { updateAsset } from "./workspaceUpdates";

export function useAssetFeed(
  options: () => { query: AssetQuery; trash?: boolean; search?: string },
) {
  const workspace = useWorkspaceStore();
  const items = shallowRef<AssetSummary[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const refreshing = ref(false);
  const error = ref("");
  const moreError = ref("");
  const hasMore = ref(false);
  const tookMs = ref<number | null>(null);
  let cursor: string | null = null;
  let controller: AbortController | null = null;
  let active = true;
  let dirty = true;
  let reloadRequested = false;
  let pendingChanges: WorkspaceChange[] = [];

  function matches(asset: AssetSummary) {
    const { query, trash } = options();
    const date = Date.parse(asset[query.timeField ?? "createdAt"] ?? "");
    return (
      asset.deleted === Boolean(trash) &&
      (!query.type || asset.type.toLowerCase() === query.type) &&
      (query.favorite === undefined || asset.isFavorite === query.favorite) &&
      (!query.status || asset.status === query.status) &&
      ((!query.tagId && !query.tag) ||
        asset.tags.some(
          (tag) =>
            (!query.tagId || tag.id === query.tagId) &&
            (!query.tag || tag.name === query.tag),
        )) &&
      (query.minSize === undefined ||
        BigInt(asset.size ?? 0) >= BigInt(query.minSize)) &&
      (!query.from || date >= Date.parse(query.from)) &&
      (!query.to || date < Date.parse(query.to)) &&
      (!query.year || new Date(date).getUTCFullYear() === query.year)
    );
  }

  function applyChange(change: WorkspaceChange) {
    if (change.type === "admin" || (change.type === "album" && change.value))
      return false;
    const { query, search } = options();
    const removedIds = new Set(
      change.type === "assets" && change.removed ? change.ids : [],
    );
    if (
      change.type === "album-members" &&
      ((!change.added && query.albumId === change.album.id) ||
        (change.added && query.uncategorized))
    )
      for (const id of change.ids) removedIds.add(id);
    if (
      change.type === "album" &&
      change.value === null &&
      query.albumId === change.id
    ) {
      items.value = [];
      hasMore.value = false;
      return false;
    }
    const previous = items.value;
    const updated = previous
      .map((asset) => updateAsset(asset, change))
      .filter((asset) => !removedIds.has(asset.id) && matches(asset));
    const candidates =
      change.type === "assets" && !change.removed
        ? change.before.map((asset) => updateAsset(asset, change))
        : change.type === "album-members" &&
            change.added &&
            query.albumId === change.album.id
          ? workspace.knownAssets(change.ids)
          : change.type === "asset-tags" && query.tagId
            ? workspace.knownAssets([change.id])
            : change.type === "asset-tags-batch" && (query.tagId || query.tag)
              ? workspace.knownAssets(change.ids)
              : [];
    const canInsert =
      search === undefined && !query.placeId && !query.uncategorized;
    const compare = (left: AssetSummary, right: AssetSummary) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id);
    if (canInsert) {
      const seen = new Set(updated.map((asset) => asset.id));
      const last = previous[previous.length - 1];
      for (const asset of candidates) {
        const albumMatches =
          !query.albumId ||
          (change.type === "album-members" &&
            change.album.id === query.albumId) ||
          (change.type === "assets" &&
            change.albumIds[asset.id]?.includes(query.albumId));
        if (
          albumMatches &&
          !seen.has(asset.id) &&
          matches(asset) &&
          (!hasMore.value || !last || compare(asset, last) <= 0)
        ) {
          updated.push(asset);
          seen.add(asset.id);
        }
      }
    }
    if (
      updated.length !== previous.length ||
      updated.some((asset, index) => asset !== previous[index])
    )
      items.value = updated.sort(compare);
    const serverFilterChanged =
      (change.type === "assets" &&
        change.patch.name !== undefined &&
        search !== undefined) ||
      ((change.type === "tag" ||
        change.type === "asset-tags" ||
        change.type === "asset-tags-batch") &&
        search !== undefined) ||
      (change.type === "tag" &&
        change.value &&
        change.id !== change.value.id &&
        query.tagId === change.value.id) ||
      (query.uncategorized &&
        ((change.type === "album" && !change.value) ||
          (change.type === "album-members" && !change.added)));
    if (serverFilterChanged) dirty = true;
    return Boolean(serverFilterChanged);
  }

  async function load(append = false, quiet = false) {
    if (!active) {
      dirty = true;
      return;
    }
    if (
      (append || quiet) &&
      (loading.value || loadingMore.value || refreshing.value)
    )
      return;
    if (append && !hasMore.value) return;
    controller?.abort();
    const current = new AbortController();
    controller = current;
    reloadRequested = false;
    pendingChanges = [];
    const settings = options();
    const query = {
      ...settings.query,
      limit: 40,
      cursor: append ? (cursor ?? undefined) : undefined,
    };
    if (quiet) {
      refreshing.value = true;
      moreError.value = "";
    } else if (append) {
      loadingMore.value = true;
      moreError.value = "";
    } else {
      refreshing.value = false;
      loading.value = true;
      loadingMore.value = false;
      error.value = "";
      moreError.value = "";
      hasMore.value = false;
      cursor = null;
      items.value = [];
    }
    try {
      const result =
        settings.search !== undefined
          ? await mediaApi.search(settings.search, query, current.signal)
          : await mediaApi.assets(query, current.signal, settings.trash);
      if (current.signal.aborted) return;
      const page =
        "mode" in result
          ? result.items.map((item) => item.asset)
          : result.items;
      const existing = append ? items.value : [];
      const seen = new Set(existing.map((item) => item.id));
      items.value = [...existing, ...page.filter((item) => !seen.has(item.id))];
      cursor = result.nextCursor;
      hasMore.value = result.hasMore && Boolean(cursor);
      tookMs.value = "tookMs" in result ? result.tookMs : null;
      dirty = false;
      for (const change of pendingChanges) applyChange(change);
      pendingChanges = [];
      workspace.rememberAssets(items.value, settings.query.albumId);
    } catch (cause) {
      if (!current.signal.aborted) {
        if (append || quiet) moreError.value = getErrorMessage(cause);
        else error.value = getErrorMessage(cause);
      }
    } finally {
      if (controller === current) {
        loading.value = false;
        loadingMore.value = false;
        refreshing.value = false;
        if (active && reloadRequested && !current.signal.aborted)
          void load(false, true);
      }
    }
  }

  watch(
    () => JSON.stringify(options()),
    () => {
      dirty = true;
      void load();
    },
    { immediate: true },
  );
  const unsubscribe = workspace.onChange((change) => {
    if (loading.value || loadingMore.value || refreshing.value)
      pendingChanges.push(change);
    const serverFilterChanged = applyChange(change);
    if (serverFilterChanged && options().search !== undefined)
      workspace.invalidate(["search"]);
  });
  const unsubscribeInvalidation = workspace.onInvalidate((resources, lazy) => {
    if (
      !resources.has("assets") &&
      !(resources.has("search") && options().search !== undefined)
    )
      return;
    dirty = true;
    if (active && !lazy) {
      if (loading.value || loadingMore.value || refreshing.value)
        reloadRequested = true;
      else void load(false, true);
    }
  });
  onActivated(() => {
    active = true;
    if (dirty && !loading.value && !refreshing.value) void load();
  });
  onDeactivated(() => {
    active = false;
    if (loading.value || loadingMore.value || refreshing.value) {
      controller?.abort();
      loading.value = false;
      loadingMore.value = false;
      refreshing.value = false;
      dirty = true;
    }
  });
  onScopeDispose(() => {
    controller?.abort();
    unsubscribe();
    unsubscribeInvalidation();
  });
  return {
    items,
    loading,
    loadingMore,
    refreshing,
    error,
    moreError,
    hasMore,
    tookMs,
    reload: () => load(),
    loadMore: () => load(true),
    poll: () => load(false, true),
  };
}
