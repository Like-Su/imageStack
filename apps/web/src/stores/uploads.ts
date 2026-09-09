import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { UPLOAD_MAX_BYTES } from "@/config/workspace";
import { useWorkspaceStore } from "./workspace";
import type { UploadedFile } from "@/types/media";

interface UploadEntry {
  id: number;
  name: string;
  size: number;
  file: File | null;
  state: "queued" | "running" | "done" | "error" | "cancelled";
  sessionId?: string;
  assetId?: string;
  error?: string;
}

export const useUploadsStore = defineStore("uploads", () => {
  const workspace = useWorkspaceStore();
  const entries = ref<UploadEntry[]>([]);
  const open = ref(false);
  const collapsed = ref(false);
  const active = computed(
    () =>
      entries.value.filter((entry) =>
        ["queued", "running"].includes(entry.state),
      ).length,
  );
  const completed = computed(
    () => entries.value.filter((entry) => entry.state === "done").length,
  );
  const controllers = new Map<number, AbortController>();
  let nextId = 0;
  let generation = 0;

  function chooseFiles() {
    if (!workspace.can("upload:create")) return;
    (
      document.getElementById("media-upload-input") as HTMLInputElement | null
    )?.click();
  }

  function add(files: File[]) {
    if (!workspace.can("upload:create")) return;
    const available = Math.max(0, 100 - entries.value.length);
    if (files.length > available)
      workspace.notify("上传队列最多保留 100 项，请先清理已完成项目。", "info");
    for (const file of files.slice(0, available)) {
      const error = !/\.(jpe?g|png|webp)$/i.test(file.name)
        ? "仅支持 JPEG、PNG 和 WebP 图片"
        : file.size < 1 || file.size > UPLOAD_MAX_BYTES
          ? "单张图片需大于 0 B 且不超过 10 MB"
          : file.name.length > 255 || /[\\/\u0000-\u001f]/.test(file.name)
            ? "文件名过长或含有不支持的字符"
            : "";
      entries.value.push({
        id: ++nextId,
        name: file.name,
        size: file.size,
        file: error ? null : file,
        state: error ? "error" : "queued",
        error,
      });
    }
    open.value = true;
    collapsed.value = false;
    pump();
  }

  function finish(entry: UploadEntry, file: UploadedFile) {
    entry.state = "done";
    entry.assetId = file.id;
    entry.file = null;
    entry.error = undefined;
    workspace.invalidate();
  }

  async function process(entry: UploadEntry) {
    const version = generation;
    const controller = new AbortController();
    controllers.set(entry.id, controller);
    entry.state = "running";
    entry.error = undefined;
    try {
      if (entry.sessionId) {
        const session = await mediaApi.uploadSession(
          entry.sessionId,
          controller.signal,
        );
        if (version !== generation) return;
        if (session.status === "COMPLETED") {
          if (!session.file)
            throw new Error(
              "服务器已完成此会话，但对应文件已不可用，请重新选择文件。",
            );
          finish(entry, session.file);
          return;
        }
        if (session.status === "UPLOADING" && !session.expired)
          throw new Error(
            "服务器仍在接收此文件，请稍后重试查询；不会重复创建上传。",
          );
        if (
          session.expired ||
          session.status === "FAILED" ||
          session.status === "CANCELLED"
        )
          entry.sessionId = undefined;
      }
      if (!entry.file) throw new Error("请重新选择文件");
      if (!entry.sessionId) {
        const session = await mediaApi.createUpload(
          entry.file,
          controller.signal,
        );
        if (version !== generation) return;
        entry.sessionId = session.id;
      }
      const result = await mediaApi.upload(
        entry.sessionId,
        entry.file,
        controller.signal,
      );
      if (version === generation) finish(entry, result.file);
    } catch (error) {
      if (version !== generation || controller.signal.aborted) return;
      if (entry.sessionId) {
        try {
          const session = await mediaApi.uploadSession(
            entry.sessionId,
            controller.signal,
          );
          if (version !== generation) return;
          if (session.status === "COMPLETED" && session.file) {
            finish(entry, session.file);
            return;
          }
        } catch {}
      }
      if (version === generation) {
        entry.state = "error";
        entry.error = getErrorMessage(error);
      }
    } finally {
      controllers.delete(entry.id);
      if (version === generation) pump();
    }
  }

  function pump() {
    while (controllers.size < 2) {
      const entry = entries.value.find((item) => item.state === "queued");
      if (!entry) break;
      void process(entry);
    }
  }

  function retry(entry: UploadEntry) {
    if (entry.state !== "error" || !entry.file) return;
    entry.state = "queued";
    pump();
  }

  function cancel(entry: UploadEntry) {
    if (entry.state === "queued") {
      entry.state = "cancelled";
      entry.file = null;
    }
  }

  function clearFinished() {
    entries.value = entries.value.filter(
      (entry) =>
        ["queued", "running"].includes(entry.state) ||
        (entry.state === "error" && entry.file),
    );
  }
  function reset() {
    generation += 1;
    for (const controller of controllers.values()) controller.abort();
    controllers.clear();
    entries.value = [];
    open.value = false;
  }

  return {
    entries,
    open,
    collapsed,
    active,
    completed,
    chooseFiles,
    add,
    retry,
    cancel,
    clearFinished,
    reset,
  };
});
