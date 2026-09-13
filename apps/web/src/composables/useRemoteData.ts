import {
  onActivated,
  onDeactivated,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type WatchSource,
} from "vue";
import { getErrorMessage } from "@/api/request";
import { invalidateCollectionCache } from "@/api/collectionCache";
import { useWorkspaceStore } from "@/stores/workspace";
import type { WorkspaceChange, WorkspaceResource } from "@/types/workspace";

export function useRemoteData<Data>(
  loader: (signal: AbortSignal) => Promise<Data>,
  sources: WatchSource[] = [],
  options: {
    resources?: WorkspaceResource[];
    update?: (data: Data, change: WorkspaceChange) => Data;
    invalidate?: () => void;
  } = {},
) {
  const workspace = useWorkspaceStore();
  const data = shallowRef<Data | null>(null);
  const loading = ref(false);
  const error = ref("");
  let controller: AbortController | null = null;
  let active = true;
  let dirty = true;
  let pendingUpdates: ((data: Data) => Data)[] = [];
  let coldInvalidation = false;

  async function refresh(): Promise<void> {
    if (!active) {
      dirty = true;
      return;
    }
    controller?.abort();
    const current = new AbortController();
    controller = current;
    loading.value = true;
    error.value = "";
    coldInvalidation = false;
    try {
      const result = await loader(current.signal);
      if (!current.signal.aborted) {
        let next: Data = result;
        for (const update of pendingUpdates) next = update(next);
        data.value = next;
        pendingUpdates = [];
        dirty = coldInvalidation;
      }
    } catch (cause) {
      if (!current.signal.aborted) error.value = getErrorMessage(cause);
    } finally {
      if (controller === current) {
        loading.value = false;
        if (coldInvalidation && !current.signal.aborted) {
          options.invalidate?.();
          void refresh();
        }
      }
    }
  }

  function mutate(update: (data: Data) => Data) {
    if (data.value !== null) {
      const next = update(data.value);
      if (next === data.value) return;
      controller?.abort();
      loading.value = false;
      data.value = next;
    } else if (loading.value) {
      pendingUpdates.push(update);
    }
  }

  const unsubscribe = workspace.onChange((change) => {
    const relativeUpdate =
      change.type === "admin"
        ? options.resources?.includes("admin")
        : change.type === "assets" &&
          (change.removed || change.patch.deleted !== undefined) &&
          options.resources?.some(
            (resource) => resource === "albums" || resource === "tags",
          );
    if (data.value === null && loading.value && relativeUpdate) {
      coldInvalidation = true;
      return;
    }
    if (options.update) mutate((value) => options.update!(value, change));
  });
  const unsubscribeInvalidation = workspace.onInvalidate((resources, lazy) => {
    if (!options.resources?.some((resource) => resources.has(resource))) return;
    dirty = true;
    options.invalidate?.();
    if (!lazy && active) void refresh();
  });

  watch(
    sources,
    (values, previous) => {
      if (previous && values.some((value, index) => value !== previous[index]))
        data.value = null;
      pendingUpdates = [];
      dirty = true;
      void refresh();
    },
    { immediate: true },
  );
  onActivated(() => {
    active = true;
    if (dirty && !loading.value) void refresh();
  });
  onDeactivated(() => {
    active = false;
    if (loading.value) {
      controller?.abort();
      loading.value = false;
      dirty = true;
    }
  });
  onScopeDispose(() => {
    controller?.abort();
    unsubscribe();
    unsubscribeInvalidation();
  });
  return {
    data,
    loading,
    error,
    mutate,
    refresh: () => {
      invalidateCollectionCache(options.resources ?? []);
      return refresh();
    },
  };
}
