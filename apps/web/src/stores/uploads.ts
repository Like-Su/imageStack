import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { mediaApi } from "@/api/media";
import { ApiError, getErrorMessage } from "@/api/request";
import {
  UPLOAD_IMAGE_MAX_BYTES,
  UPLOAD_VIDEO_MAX_BYTES,
  uploadMediaKind,
} from "@/config/workspace";
import { useWorkspaceStore } from "./workspace";
import type { UploadedFile, UploadSession } from "@/types/media";
import { hashFile } from "@/uploads/hash-file";
import type { FileDigest } from "@/uploads/hash-file";
import { uploadDelay, uploadParts } from "@/uploads/upload-parts";

interface UploadEntry {
  id: number;
  name: string;
  size: number;
  file: File | null;
  state: "queued" | "running" | "paused" | "done" | "error" | "cancelled";
  phase: "hashing" | "uploading" | "verifying";
  uploadedBytes: number;
  hashProgress: number;
  digest?: FileDigest;
  instant?: boolean;
  resumed?: boolean;
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
      const kind = uploadMediaKind(file.name);
      const maxBytes =
        kind === "video" ? UPLOAD_VIDEO_MAX_BYTES : UPLOAD_IMAGE_MAX_BYTES;
      const error = !kind
        ? "请选择受支持的图片或 MP4 / MOV / MKV 视频"
        : file.size < 1 || file.size > maxBytes
          ? kind === "video"
            ? "视频需大于 0 B 且不超过 512 MiB"
            : "图片需大于 0 B 且不超过 10 MiB"
          : file.name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(file.name)
            ? "文件名过长或含有不支持的字符"
            : "";
      entries.value.push({
        id: ++nextId,
        name: file.name,
        size: file.size,
        file: error ? null : file,
        state: error ? "error" : "queued",
        phase: "hashing",
        uploadedBytes: 0,
        hashProgress: 0,
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
    entry.digest = undefined;
    entry.uploadedBytes = entry.size;
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
      let session: UploadSession | undefined;
      if (entry.sessionId) {
        try {
          session = await mediaApi.uploadSession(
            entry.sessionId,
            controller.signal,
          );
        } catch (error) {
          if (!(error instanceof ApiError && [404, 410].includes(error.status)))
            throw error;
          entry.sessionId = undefined;
        }
        if (version !== generation) return;
        if (session?.status === "COMPLETED") {
          if (!session.file)
            throw new Error(
              "服务器已完成此会话，但对应文件已不可用，请重新选择文件。",
            );
          finish(entry, session.file);
          return;
        }
        if (
          session?.expired ||
          session?.status === "FAILED" ||
          session?.status === "CANCELLED"
        ) {
          entry.sessionId = undefined;
          session = undefined;
        }
      }
      if (!entry.file) throw new Error("请重新选择文件");
      if (!entry.digest) {
        entry.phase = "hashing";
        entry.digest = await hashFile(
          entry.file,
          controller.signal,
          (loaded) => {
            entry.hashProgress = Math.round((loaded / entry.size) * 100);
          },
        );
      }
      controller.signal.throwIfAborted();
      if (!session) {
        session = await mediaApi.createUpload(
          entry.file,
          entry.digest.hash,
          controller.signal,
        );
        if (version !== generation) return;
        entry.sessionId = session.id;
      }
      if (session.status === "COMPLETED" && session.file) {
        entry.instant = session.instant;
        finish(entry, session.file);
        return;
      }
      if (session.merging) {
        entry.phase = "verifying";
        session = await waitForMerge(session, controller.signal);
        if (session.status === "COMPLETED" && session.file) {
          finish(entry, session.file);
          return;
        }
      }
      entry.phase = "uploading";
      entry.resumed = session.uploadedBytes > 0;
      entry.uploadedBytes = session.uploadedBytes;
      if (session.mode === "CHUNKED") {
        await uploadParts(
          entry.file,
          session,
          entry.digest,
          controller.signal,
          (uploadedBytes) => {
            if (!controller.signal.aborted) entry.uploadedBytes = uploadedBytes;
          },
        );
      }
      controller.signal.throwIfAborted();
      entry.phase = session.mode === "CHUNKED" ? "verifying" : "uploading";
      const result =
        session.mode === "CHUNKED"
          ? await mediaApi.completeUpload(session.id, controller.signal)
          : await mediaApi.upload(session.id, entry.file, controller.signal);
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
      if (controllers.get(entry.id) === controller)
        controllers.delete(entry.id);
      if (version === generation) pump();
    }
  }

  async function waitForMerge(session: UploadSession, signal: AbortSignal) {
    const deadline = Date.now() + 660_000;
    while (session.merging && !session.expired) {
      if (Date.now() >= deadline)
        throw new Error(
          "服务器仍在校验合并，可稍后继续；已上传的分片不会重复发送。",
        );
      await uploadDelay(3000, signal);
      session = await mediaApi.uploadSession(session.id, signal);
    }
    return session;
  }

  function pump() {
    while (controllers.size < 2) {
      const entry = entries.value.find(
        (item) => item.state === "queued" && !controllers.has(item.id),
      );
      if (!entry) break;
      void process(entry);
    }
  }

  function retry(entry: UploadEntry) {
    if (!["error", "paused"].includes(entry.state) || !entry.file) return;
    entry.state = "queued";
    pump();
  }

  function cancel(entry: UploadEntry) {
    if (!["queued", "running", "paused", "error"].includes(entry.state)) return;
    controllers.get(entry.id)?.abort();
    entry.state = "cancelled";
    entry.file = null;
    entry.digest = undefined;
    if (entry.sessionId) {
      const sessionId = entry.sessionId;
      const version = generation;
      void mediaApi.cancelUpload(sessionId).catch(async (error: unknown) => {
        if (error instanceof ApiError && error.status === 409) {
          const session = await mediaApi
            .uploadSession(sessionId)
            .catch(() => null);
          if (
            version === generation &&
            session?.status === "COMPLETED" &&
            session.file
          )
            finish(entry, session.file);
        }
      });
    }
    pump();
  }

  function pause(entry: UploadEntry) {
    if (!["queued", "running"].includes(entry.state)) return;
    entry.state = "paused";
    controllers.get(entry.id)?.abort();
    pump();
  }

  function clearFinished() {
    entries.value = entries.value.filter(
      (entry) =>
        ["queued", "running", "paused"].includes(entry.state) ||
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
    pause,
    cancel,
    clearFinished,
    reset,
  };
});
