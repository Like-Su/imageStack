import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { mediaApi } from "@/api/media";
import { ApiError, getErrorMessage } from "@/api/request";
import { useAuthStore } from "./auth";
import type { AssetSummary, LibraryOverview } from "@/types/media";

interface Notice {
  id: number;
  message: string;
  kind: "success" | "error" | "info";
}
interface Confirmation {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export const useWorkspaceStore = defineStore("workspace", () => {
  const auth = useAuthStore();
  const overview = shallowRef<LibraryOverview | null>(null);
  const overviewError = ref("");
  const revision = ref(0);
  const selectedAsset = shallowRef<AssetSummary | null>(null);
  const notices = ref<Notice[]>([]);
  const confirmation = shallowRef<Confirmation | null>(null);
  const favoriteBusy = ref(new Set<string>());
  const pendingTasks = computed(() =>
    overview.value
      ? overview.value.statuses.PENDING + overview.value.statuses.PROCESSING
      : 0,
  );
  let overviewController: AbortController | null = null;
  let noticeId = 0;
  let confirmationResolve: ((answer: boolean) => void) | null = null;
  const timers = new Map<number, number>();

  function can(permission: string) {
    return (
      auth.user?.roleCode === "ROLE_ADMIN" ||
      Boolean(auth.user?.permissions.includes(permission))
    );
  }

  function dismissNotice(id: number) {
    window.clearTimeout(timers.get(id));
    timers.delete(id);
    notices.value = notices.value.filter((notice) => notice.id !== id);
  }

  function notify(message: string, kind: Notice["kind"] = "success") {
    const id = ++noticeId;
    notices.value.push({ id, message, kind });
    if (notices.value.length > 4) dismissNotice(notices.value[0]!.id);
    timers.set(
      id,
      window.setTimeout(
        () => dismissNotice(id),
        kind === "error" ? 9000 : 4500,
      ),
    );
  }

  async function loadOverview() {
    if (!can("asset:list")) return;
    overviewController?.abort();
    const controller = new AbortController();
    overviewController = controller;
    try {
      const result = await mediaApi.overview(controller.signal);
      if (controller.signal.aborted) return;
      overview.value = result;
      overviewError.value = "";
    } catch (error) {
      if (!controller.signal.aborted)
        overviewError.value = getErrorMessage(error);
    }
  }

  function invalidate() {
    revision.value += 1;
    void loadOverview();
  }

  function confirm(options: Confirmation) {
    confirmationResolve?.(false);
    confirmation.value = options;
    return new Promise<boolean>((resolve) => {
      confirmationResolve = resolve;
    });
  }

  function answerConfirmation(answer: boolean) {
    confirmation.value = null;
    confirmationResolve?.(answer);
    confirmationResolve = null;
  }

  async function perform<Result>(
    action: () => Promise<Result>,
    message: string | ((result: Result) => string),
  ) {
    const sessionVersion = auth.getSessionVersion();
    try {
      const result = await action();
      if (sessionVersion !== auth.getSessionVersion()) return false;
      invalidate();
      notify(typeof message === "function" ? message(result) : message);
      return true;
    } catch (error) {
      if (
        sessionVersion === auth.getSessionVersion() &&
        !(
          error instanceof ApiError &&
          ["AUTH_CHANGED", "ABORTED"].includes(error.code)
        )
      )
        notify(getErrorMessage(error), "error");
      return false;
    }
  }

  async function toggleFavorite(asset: AssetSummary) {
    if (favoriteBusy.value.has(asset.id) || !can("asset:edit")) return;
    favoriteBusy.value.add(asset.id);
    try {
      await perform(
        () => mediaApi.favorite(asset.id, !asset.isFavorite),
        asset.isFavorite ? "已取消收藏" : "已加入收藏",
      );
    } finally {
      favoriteBusy.value.delete(asset.id);
    }
  }

  function reset() {
    overviewController?.abort();
    overview.value = null;
    overviewError.value = "";
    selectedAsset.value = null;
    favoriteBusy.value.clear();
    answerConfirmation(false);
    for (const timer of timers.values()) window.clearTimeout(timer);
    timers.clear();
    notices.value = [];
  }

  return {
    overview,
    overviewError,
    revision,
    selectedAsset,
    notices,
    confirmation,
    favoriteBusy,
    pendingTasks,
    can,
    notify,
    dismissNotice,
    loadOverview,
    invalidate,
    confirm,
    answerConfirmation,
    perform,
    toggleFavorite,
    reset,
  };
});
