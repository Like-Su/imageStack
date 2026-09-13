import { onScopeDispose, ref, watch } from "vue";
import { API_BASE_URL } from "@/config/api";
import { readServerEvents } from "@/api/server-events";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";
import { usePreferencesStore } from "@/stores/preferences";
import type { WorkspaceResource } from "@/types/workspace";
import { translate } from "@/i18n";
import {
  emitVideoSummaryEvent,
  parseVideoSummaryUpdate,
  parseWorkspaceResources,
  readWorkspaceEventSupport,
  setVideoSummaryConnection,
  workspaceEventsAvailable,
} from "./videoSummaryEvents";

const reconciliationResources: WorkspaceResource[] = [
  "ai",
  "processing",
  "overview",
  "places",
  "search",
];

function validCursor(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    /^\d{1,19}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

function waitForRetry(delay: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, delay);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

function retryAfterMs(response: Response) {
  const value = response.headers.get("Retry-After");
  if (!value) return 0;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? Math.max(0, Math.min(86400000, delay)) : 0;
}

export function useVideoSummaryEvents() {
  const auth = useAuthStore();
  const workspace = useWorkspaceStore();
  const preferences = usePreferencesStore();
  const pendingResources = new Set<WorkspaceResource>();
  let invalidationTimer: number | undefined;
  let controller: AbortController | undefined;
  const online = ref(navigator.onLine);
  const updateOnline = () => {
    online.value = navigator.onLine;
  };
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);

  function scheduleInvalidation(resources: WorkspaceResource[] = []) {
    for (const resource of resources) pendingResources.add(resource);
    if (
      invalidationTimer !== undefined ||
      !pendingResources.size ||
      !preferences.values.autoRefresh ||
      document.visibilityState !== "visible" ||
      !online.value
    )
      return;
    invalidationTimer = window.setTimeout(() => {
      invalidationTimer = undefined;
      if (
        !auth.isAuthenticated ||
        !preferences.values.autoRefresh ||
        document.visibilityState !== "visible" ||
        !online.value
      )
        return;
      const resources = [...pendingResources];
      pendingResources.clear();
      workspace.invalidate(resources);
    }, 5000);
  }

  function visibilityChanged() {
    if (
      document.visibilityState === "visible" &&
      workspaceEventsAvailable.value
    )
      scheduleInvalidation(reconciliationResources);
  }
  document.addEventListener("visibilitychange", visibilityChanged);
  watch(
    () => preferences.values.autoRefresh,
    (enabled) => {
      if (enabled && workspaceEventsAvailable.value)
        scheduleInvalidation(reconciliationResources);
    },
  );

  async function connect(userId: string, signal: AbortSignal) {
    const scope = auth.getSessionVersion();
    const storageKey = `image_stack_video_events:${userId}`;
    let cursor: string | undefined;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (validCursor(saved)) cursor = saved;
    } catch {}
    let delay = 1000;
    let refreshed = false;
    const current = () =>
      !signal.aborted &&
      auth.user?.id === userId &&
      auth.getSessionVersion() === scope;
    while (current()) {
      const token = auth.accessToken;
      if (!token) return;
      const connection = new AbortController();
      const abort = () => connection.abort();
      signal.addEventListener("abort", abort, { once: true });
      let timeout: number | undefined;
      let retryAfter = 0;
      const openedAt = Date.now();
      const received = () => {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(abort, 45000);
        if (Date.now() - openedAt >= 15000) delay = 1000;
      };
      received();
      try {
        const query =
          cursor === undefined ? "" : `?after=${encodeURIComponent(cursor)}`;
        const response = await fetch(
          `${API_BASE_URL}/video-summaries/events${query}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "text/event-stream",
            },
            credentials: "include",
            cache: "no-store",
            redirect: "error",
            signal: connection.signal,
          },
        );
        if (!current()) {
          await response.body?.cancel();
          return;
        }
        if (response.status === 401) {
          await response.body?.cancel();
          if (auth.accessToken !== token) continue;
          if (refreshed) {
            auth.clearSession();
            return;
          }
          if (!(await auth.refreshSession())) return;
          refreshed = true;
          continue;
        }
        if (response.status === 403) {
          await response.body?.cancel();
          setVideoSummaryConnection("offline");
          return;
        }
        if (
          !response.ok ||
          !response.headers.get("Content-Type")?.includes("text/event-stream")
        ) {
          retryAfter = retryAfterMs(response);
          await response.body?.cancel();
          throw new Error("Video summary events unavailable");
        }
        refreshed = false;
        await readServerEvents(response, connection.signal, (event) => {
          received();
          if (!current()) return;
          if (event.type === "workspace-changed") {
            const resources = parseWorkspaceResources(event.data);
            if (resources) scheduleInvalidation(resources);
            return;
          }
          if (!validCursor(event.id)) return;
          if (event.type === "connected") {
            setVideoSummaryConnection("connected");
            if (readWorkspaceEventSupport(event.data))
              scheduleInvalidation(reconciliationResources);
            emitVideoSummaryEvent({ type: "connected" });
          }
          if (cursor !== undefined && BigInt(event.id) <= BigInt(cursor))
            return;
          if (event.type === "video-summary") {
            const update = parseVideoSummaryUpdate(event.data);
            if (!update) return;
            emitVideoSummaryEvent({ type: "summary", value: update });
            if (
              ["READY", "FAILED"].includes(update.status) &&
              update.status === update.result.status
            )
              workspace.notify(
                translate(
                  update.status === "READY"
                    ? "视频总结完毕：{value1}"
                    : "视频总结失败：{value1}，可在详情中重试",
                  { value1: update.name },
                ),
                update.status === "READY" ? "success" : "error",
              );
          } else if (event.type !== "connected") return;
          cursor = event.id;
          try {
            sessionStorage.setItem(storageKey, cursor);
          } catch {}
        });
      } catch {
        if (!current()) return;
      } finally {
        window.clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
        connection.abort();
      }
      if (current()) {
        setVideoSummaryConnection("reconnecting");
        delay = Math.min(60000, delay * 2);
        await waitForRetry(
          Math.max(
            retryAfter,
            delay + Math.random() * Math.min(5000, delay / 5),
          ),
          signal,
        );
      }
    }
  }

  watch(
    [
      () => auth.user?.id,
      () => auth.isAuthenticated,
      () => workspace.can("asset:list"),
      () => online.value,
    ],
    ([userId, authenticated, allowed, connected]) => {
      controller?.abort();
      window.clearTimeout(invalidationTimer);
      invalidationTimer = undefined;
      pendingResources.clear();
      if (!userId || !authenticated || !allowed || !connected) {
        setVideoSummaryConnection("offline");
        return;
      }
      setVideoSummaryConnection("connecting");
      controller = new AbortController();
      void connect(userId, controller.signal);
    },
    { immediate: true },
  );
  onScopeDispose(() => {
    controller?.abort();
    window.clearTimeout(invalidationTimer);
    pendingResources.clear();
    setVideoSummaryConnection("offline");
    document.removeEventListener("visibilitychange", visibilityChanged);
    window.removeEventListener("online", updateOnline);
    window.removeEventListener("offline", updateOnline);
  });
}
