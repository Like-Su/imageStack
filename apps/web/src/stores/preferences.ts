import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { useAuthStore } from "./auth";

interface Preferences {
  viewMode: "grid" | "list";
  showNames: boolean;
  denseGrid: boolean;
  autoRefresh: boolean;
  animations: boolean;
}

const defaults = (): Preferences => ({
  viewMode: "grid",
  showNames: false,
  denseGrid: false,
  autoRefresh: true,
  animations: true,
});

export const usePreferencesStore = defineStore("preferences", () => {
  const auth = useAuthStore();
  const values = ref(defaults());
  const storageError = ref("");
  const storageKey = () => `media-hub.preferences.${auth.user?.id ?? "guest"}`;

  watch(
    () => auth.user?.id,
    () => {
      const next = defaults();
      storageError.value = "";
      try {
        const stored: unknown = JSON.parse(
          localStorage.getItem(storageKey()) ?? "null",
        );
        if (stored && typeof stored === "object") {
          const record = stored as Record<string, unknown>;
          if (record.viewMode === "grid" || record.viewMode === "list")
            next.viewMode = record.viewMode;
          for (const key of [
            "showNames",
            "denseGrid",
            "autoRefresh",
            "animations",
          ] as const) {
            if (typeof record[key] === "boolean") next[key] = record[key];
          }
        }
      } catch {
        storageError.value = "浏览器无法读取偏好，当前使用默认设置。";
      }
      values.value = next;
    },
    { immediate: true, flush: "sync" },
  );

  watch(
    values,
    (value) => {
      try {
        localStorage.setItem(storageKey(), JSON.stringify(value));
      } catch {
        storageError.value = "浏览器禁止本地存储，设置仅在本次页面中生效。";
      }
    },
    { deep: true },
  );

  function reset() {
    values.value = defaults();
  }
  return { values, storageError, reset };
});
