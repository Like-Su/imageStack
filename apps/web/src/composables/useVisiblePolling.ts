import {
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  watch,
} from "vue";
import { usePreferencesStore } from "@/stores/preferences";

export function useVisiblePolling(
  action: () => Promise<unknown>,
  interval: () => number | false,
) {
  const preferences = usePreferencesStore();
  let active = true;
  let running = false;
  let timer: number | undefined;

  function schedule() {
    window.clearTimeout(timer);
    const delay = interval();
    if (
      !active ||
      running ||
      !delay ||
      !preferences.values.autoRefresh ||
      document.visibilityState !== "visible"
    )
      return;
    timer = window.setTimeout(async () => {
      running = true;
      try {
        await action();
      } finally {
        running = false;
        schedule();
      }
    }, delay);
  }

  watch([interval, () => preferences.values.autoRefresh], schedule, {
    immediate: true,
  });
  onMounted(() => document.addEventListener("visibilitychange", schedule));
  onActivated(() => {
    active = true;
    schedule();
  });
  onDeactivated(() => {
    active = false;
    window.clearTimeout(timer);
  });
  onScopeDispose(() => {
    active = false;
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", schedule);
  });
}
