import { onScopeDispose, ref, shallowRef, watch, type WatchSource } from "vue";
import { getErrorMessage } from "@/api/request";
import { useWorkspaceStore } from "@/stores/workspace";

export function useRemoteData<Data>(
  loader: (signal: AbortSignal) => Promise<Data>,
  sources: WatchSource[] = [],
) {
  const workspace = useWorkspaceStore();
  const data = shallowRef<Data | null>(null);
  const loading = ref(false);
  const error = ref("");
  let controller: AbortController | null = null;

  async function refresh() {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    loading.value = true;
    error.value = "";
    try {
      const result = await loader(current.signal);
      if (!current.signal.aborted) data.value = result;
    } catch (cause) {
      if (!current.signal.aborted) error.value = getErrorMessage(cause);
    } finally {
      if (controller === current) loading.value = false;
    }
  }

  watch(
    [() => workspace.revision, ...sources],
    (values, previous) => {
      if (
        previous &&
        values.slice(1).some((value, index) => value !== previous[index + 1])
      )
        data.value = null;
      void refresh();
    },
    { immediate: true },
  );
  onScopeDispose(() => controller?.abort());
  return { data, loading, error, refresh };
}
