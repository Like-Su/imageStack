import { computed, readonly, ref } from "vue";
import type { VideoSummaryUpdate } from "@/types/media";
import type { WorkspaceResource } from "@/types/workspace";

type ConnectionState = "connecting" | "connected" | "reconnecting" | "offline";
type VideoSummaryEvent =
  { type: "connected" } | { type: "summary"; value: VideoSummaryUpdate };

const state = ref<ConnectionState>("connecting");
const workspaceSupport = ref(false);
const workspaceResources = [
  "ai",
  "processing",
  "overview",
  "places",
  "search",
] as const;
const listeners = new Set<(event: VideoSummaryEvent) => void>();

export const videoSummaryConnection = readonly(state);
export const workspaceEventsAvailable = computed(
  () => state.value === "connected" && workspaceSupport.value,
);

export function setVideoSummaryConnection(value: ConnectionState) {
  state.value = value;
  if (value !== "connected") workspaceSupport.value = false;
}

export function readWorkspaceEventSupport(text: string) {
  try {
    const value: unknown = JSON.parse(text);
    workspaceSupport.value = Boolean(
      value &&
      typeof value === "object" &&
      "workspaceUpdates" in value &&
      value.workspaceUpdates === true,
    );
  } catch {
    workspaceSupport.value = false;
  }
  return workspaceSupport.value;
}

export function parseWorkspaceResources(
  text: string,
): WorkspaceResource[] | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || !("resources" in value))
      return null;
    const resources = value.resources;
    if (
      !Array.isArray(resources) ||
      !resources.length ||
      resources.length > workspaceResources.length ||
      !resources.every((resource) => workspaceResources.includes(resource))
    )
      return null;
    return resources;
  } catch {
    return null;
  }
}

export function onVideoSummaryEvent(
  listener: (event: VideoSummaryEvent) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitVideoSummaryEvent(event: VideoSummaryEvent) {
  for (const listener of listeners) listener(event);
}

export function waitForVideoSummaryConnection(signal: AbortSignal) {
  if (state.value === "connected" || signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      unsubscribe();
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const unsubscribe = onVideoSummaryEvent((event) => {
      if (event.type === "connected") finish();
    });
    const timer = window.setTimeout(finish, 1000);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

export function parseVideoSummaryUpdate(
  text: string,
): VideoSummaryUpdate | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object") return null;
    const update = value as Record<string, unknown>;
    if (
      typeof update.assetId !== "string" ||
      typeof update.name !== "string" ||
      !["PENDING", "PROCESSING", "READY", "FAILED"].includes(
        String(update.status),
      ) ||
      !update.result ||
      typeof update.result !== "object"
    )
      return null;
    const result = update.result as Record<string, unknown>;
    if (
      !["PENDING", "PROCESSING", "READY", "FAILED"].includes(
        String(result.status),
      ) ||
      !["TRANSCRIBING", "SUMMARIZING"].includes(String(result.stage)) ||
      typeof result.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(result.updatedAt)) ||
      !["attempts", "transcribedChunks"].every((key) => {
        const count = result[key];
        return (
          typeof count === "number" && Number.isSafeInteger(count) && count >= 0
        );
      }) ||
      ![
        "language",
        "summary",
        "model",
        "error",
        "nextAttemptAt",
        "completedAt",
      ].every((key) => result[key] === null || typeof result[key] === "string")
    )
      return null;
    return value as VideoSummaryUpdate;
  } catch {
    return null;
  }
}
