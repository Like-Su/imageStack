import { onScopeDispose, ref, shallowRef, watch } from "vue";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useWorkspaceStore } from "@/stores/workspace";
import type { AssetQuery, AssetSummary } from "@/types/media";

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

  async function load(append = false, quiet = false) {
    if (
      (append || quiet) &&
      (loading.value || loadingMore.value || refreshing.value)
    )
      return;
    if (append && !hasMore.value) return;
    controller?.abort();
    const current = new AbortController();
    controller = current;
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
      }
    }
  }

  watch(
    [() => JSON.stringify(options()), () => workspace.revision],
    () => {
      void load();
    },
    { immediate: true },
  );
  onScopeDispose(() => controller?.abort());
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
