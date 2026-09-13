import { onScopeDispose, watch } from "vue";
import { API_BASE_URL } from "@/config/api";
import { readServerEvents } from "@/api/server-events";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";
import { translate } from "@/i18n";

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

export function useVideoSummaryEvents() {
  const auth = useAuthStore();
  const workspace = useWorkspaceStore();
  let controller: AbortController | undefined;

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
      const timeout = window.setTimeout(abort, 75000);
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
          return;
        }
        if (
          !response.ok ||
          !response.headers.get("Content-Type")?.includes("text/event-stream")
        ) {
          await response.body?.cancel();
          throw new Error("Video summary events unavailable");
        }
        refreshed = false;
        await readServerEvents(response, connection.signal, (event) => {
          if (!current() || !validCursor(event.id)) return;
          if (event.type === "connected")
            workspace.invalidate(["video-summaries"]);
          if (cursor !== undefined && BigInt(event.id) <= BigInt(cursor))
            return;
          if (event.type === "video-summary") {
            const result: unknown = JSON.parse(event.data);
            if (
              !result ||
              typeof result !== "object" ||
              !("assetId" in result) ||
              typeof result.assetId !== "string" ||
              !("name" in result) ||
              typeof result.name !== "string" ||
              !("status" in result) ||
              !["READY", "FAILED"].includes(String(result.status))
            )
              return;
            workspace.notify(
              translate(
                result.status === "READY"
                  ? "视频总结完毕：{value1}"
                  : "视频总结失败：{value1}，可在详情中重试",
                { value1: result.name },
              ),
              result.status === "READY" ? "success" : "error",
            );
            workspace.invalidate(["video-summaries"]);
          } else if (event.type !== "connected") return;
          cursor = event.id;
          try {
            sessionStorage.setItem(storageKey, cursor);
          } catch {}
        });
        delay = 1000;
      } catch {
        if (!current()) return;
        delay = Math.min(30000, delay * 2);
      } finally {
        window.clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
        connection.abort();
      }
      if (current()) await waitForRetry(delay, signal);
    }
  }

  watch(
    [
      () => auth.user?.id,
      () => auth.isAuthenticated,
      () => workspace.can("asset:list"),
    ],
    ([userId, authenticated, allowed]) => {
      controller?.abort();
      if (!userId || !authenticated || !allowed) return;
      controller = new AbortController();
      void connect(userId, controller.signal);
    },
    { immediate: true },
  );
  onScopeDispose(() => controller?.abort());
}
