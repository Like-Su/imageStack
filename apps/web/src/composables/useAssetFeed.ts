import {
  computed,
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
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import type { AssetQuery, AssetSummary } from "@/types/media";
import type { WorkspaceChange } from "@/types/workspace";
import { assetChangeIds, updateAsset } from "./workspaceUpdates";

export function useAssetFeed(
  options: () => { query: AssetQuery; trash?: boolean; search?: string },
) {
  const workspace = useWorkspaceStore();
  const auth = useAuthStore();
  const preferences = usePreferencesStore();
  const settings = computed(() => {
    const current = options();
    return {
      ...current,
      query: {
        ...current.query,
        sortBy: current.query.sortBy ?? preferences.values.assetSortBy,
        sortOrder: current.query.sortOrder ?? preferences.values.assetSortOrder,
      },
    };
  });
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
  const positions = new Map<string, number>();

  function replaceItems(next: AssetSummary[], reindex = true) {
    if (reindex) {
      positions.clear();
      next.forEach((asset, index) => positions.set(asset.id, index));
    }
    items.value = next;
  }

  function matches(asset: AssetSummary) {
    const { query, trash } = settings.value;
    const date = Date.parse(asset[query.timeField ?? "createdAt"] ?? "");
    return (
      (Boolean(query.albumId) || asset.ownerId === auth.user?.id) &&
      asset.deleted === Boolean(trash) &&
      (!query.type || asset.type.toLowerCase() === query.type) &&
      (query.favorite === undefined ||
        (asset.ownerId === auth.user?.id &&
          asset.isFavorite === query.favorite)) &&
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
    const { query, search } = settings.value;
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
      replaceItems([]);
      hasMore.value = false;
      return false;
    }
    const previous = items.value;
    let updated = previous;
    const removedPositions = new Set<number>();
    const targets =
      assetChangeIds(change) ?? (change.type === "tag" ? positions.keys() : []);
    for (const id of targets) {
      const index = positions.get(id);
      if (index === undefined) continue;
      const asset = previous[index]!;
      const next = updateAsset(asset, change);
      if (removedIds.has(id) || !matches(next)) {
        removedPositions.add(index);
      } else if (next !== asset) {
        if (updated === previous) updated = [...previous];
        updated[index] = next;
      }
    }
    if (removedPositions.size)
      updated = updated.filter((_asset, index) => !removedPositions.has(index));
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
      query.sortBy !== "name" &&
      search === undefined &&
      !query.placeId &&
      !query.uncategorized;
    const direction = query.sortOrder === "asc" ? 1 : -1;
    const compare = (left: AssetSummary, right: AssetSummary) => {
      let primary = 0;
      if (query.sortBy === "size") {
        if (left.size === null && right.size !== null) return 1;
        if (left.size !== null && right.size === null) return -1;
        if (left.size !== null && right.size !== null) {
          const leftSize = BigInt(left.size);
          const rightSize = BigInt(right.size);
          primary = leftSize < rightSize ? -1 : leftSize > rightSize ? 1 : 0;
        }
      } else {
        primary = left.createdAt.localeCompare(right.createdAt);
      }
      return direction * (primary || left.id.localeCompare(right.id));
    };
    let inserted = false;
    if (canInsert && candidates.length) {
      const added = new Set<string>();
      const last = previous[previous.length - 1];
      for (const asset of candidates) {
        const position = positions.get(asset.id);
        if (position !== undefined && !removedPositions.has(position)) continue;
        const albumMatches =
          !query.albumId ||
          (change.type === "album-members" &&
            change.album.id === query.albumId) ||
          (change.type === "assets" &&
            change.albumIds[asset.id]?.includes(query.albumId));
        if (
          albumMatches &&
          !added.has(asset.id) &&
          matches(asset) &&
          (!hasMore.value || !last || compare(asset, last) <= 0)
        ) {
          if (updated === previous) updated = [...previous];
          updated.push(asset);
          added.add(asset.id);
          inserted = true;
        }
      }
    }
    const sortFieldChanged =
      change.type === "assets" &&
      (change.patch[query.sortBy] !== undefined ||
        change.patch.id !== undefined);
    if (updated !== previous) {
      const orderChanged =
        inserted || (query.sortBy !== "name" && sortFieldChanged);
      if (orderChanged) updated.sort(compare);
      replaceItems(updated, orderChanged || removedPositions.size > 0);
    }
    const serverFilterChanged =
      sortFieldChanged ||
      (query.sortBy === "name" &&
        candidates.some(
          (asset) => !positions.has(asset.id) && matches(asset),
        )) ||
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
    ) {
      if (quiet) reloadRequested = true;
      return;
    }
    if (append && !hasMore.value) return;
    controller?.abort();
    const current = new AbortController();
    controller = current;
    reloadRequested = false;
    pendingChanges = [];
    const currentSettings = settings.value;
    const query = {
      ...currentSettings.query,
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
      replaceItems([]);
    }
    try {
      const result =
        currentSettings.search !== undefined
          ? await mediaApi.search(currentSettings.search, query, current.signal)
          : await mediaApi.assets(query, current.signal, currentSettings.trash);
      if (current.signal.aborted) return;
      const page =
        "mode" in result
          ? result.items.map((item) => item.asset)
          : result.items;
      const existing = append ? items.value : [];
      const seen = new Set(existing.map((item) => item.id));
      replaceItems([...existing, ...page.filter((item) => !seen.has(item.id))]);
      cursor = result.nextCursor;
      hasMore.value =
        result.hasMore && Boolean(cursor) && cursor !== query.cursor;
      tookMs.value = "tookMs" in result ? result.tookMs : null;
      dirty = false;
      for (const change of pendingChanges) applyChange(change);
      pendingChanges = [];
      workspace.rememberAssets(
        page.flatMap((asset) => {
          const index = positions.get(asset.id);
          return index === undefined ? [] : [items.value[index]!];
        }),
        currentSettings.query.albumId,
      );
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
    () => JSON.stringify(settings.value),
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
    if (serverFilterChanged) {
      if (settings.value.search !== undefined) workspace.invalidate(["search"]);
      else if (active) {
        if (loading.value || loadingMore.value || refreshing.value)
          reloadRequested = true;
        else void load(false, true);
      }
    }
  });
  const unsubscribeInvalidation = workspace.onInvalidate((resources, lazy) => {
    if (
      !resources.has("assets") &&
      !(resources.has("search") && settings.value.search !== undefined)
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
    loadMore: () => (dirty ? load() : load(true)),
    poll: () => load(false, true),
  };
}
