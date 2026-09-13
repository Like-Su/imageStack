import { translate } from "@/i18n";
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
import type { UploadSession } from "@/types/media";
import { hashFile } from "@/uploads/hash-file";
import type { FileDigest } from "@/uploads/hash-file";
import { uploadDelay, uploadParts } from "@/uploads/upload-parts";

interface UploadEntry {
  id: number;
  name: string;
  size: number;
  file: File | null;
  state: "queued" | "running" | "paused" | "done" | "error" | "cancelled";
  phase: "hashing" | "uploading" | "verifying" | "album";
  uploadedBytes: number;
  hashProgress: number;
  digest?: FileDigest;
  instant?: boolean;
  resumed?: boolean;
  sessionId?: string;
  assetId?: string;
  albumId?: string;
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

  function canUpload(albumId?: string) {
    return (
      workspace.can("upload:create") &&
      (!albumId || workspace.can("asset:category"))
    );
  }

  function chooseFiles(albumId?: string) {
    if (!canUpload(albumId)) return;
    const input = document.getElementById(
      "media-upload-input",
    ) as HTMLInputElement | null;
    if (!input) return;
    const version = generation;
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      input.value = "";
      input.onchange = null;
      if (version === generation && files.length) add(files, albumId);
    };
    input.click();
  }

  function add(files: File[], albumId?: string) {
    if (!canUpload(albumId)) return;
    const available = Math.max(0, 100 - entries.value.length);
    if (files.length > available)
      workspace.notify(
        translate("上传队列最多保留 100 项，请先清理已完成项目。"),
        "info",
      );
    for (const file of files.slice(0, available)) {
      const kind = uploadMediaKind(file.name);
      const maxBytes =
        kind === "video" ? UPLOAD_VIDEO_MAX_BYTES : UPLOAD_IMAGE_MAX_BYTES;
      const error = !kind
        ? translate("请选择受支持的图片或 MP4 / MOV / MKV 视频")
        : file.size < 1 || file.size > maxBytes
          ? kind === "video"
            ? translate("视频需大于 0 B 且不超过 512 MiB")
            : translate("图片需大于 0 B 且不超过 10 MiB")
          : file.name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(file.name)
            ? translate("文件名过长或含有不支持的字符")
            : "";
      entries.value.push({
        id: ++nextId,
        name: file.name,
        size: file.size,
        file: error ? null : file,
        albumId,
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

  function rememberUploaded(entry: UploadEntry, assetId: string) {
    const newlyUploaded = !entry.assetId;
    entry.assetId = assetId;
    entry.file = null;
    entry.digest = undefined;
    entry.uploadedBytes = entry.size;
    return newlyUploaded;
  }

  function invalidateUploaded() {
    workspace.invalidate(["assets", "overview"]);
    workspace.invalidate(["places", "ai"], true);
  }

  async function finish(
    entry: UploadEntry,
    assetId: string,
    signal: AbortSignal,
    version: number,
  ) {
    if (signal.aborted || version !== generation) return;
    const newlyUploaded = rememberUploaded(entry, assetId);
    try {
      if (entry.albumId) {
        entry.phase = "album";
        const result = await mediaApi.addToAlbum(
          entry.albumId,
          [assetId],
          signal,
        );
        if (signal.aborted || version !== generation) return;
        workspace.updateAlbumMembers(result.album, [assetId], true);
        if (!newlyUploaded && !workspace.knownAssets([assetId]).length)
          workspace.invalidate(["assets"]);
      }
      entry.state = "done";
      entry.error = undefined;
    } finally {
      if (newlyUploaded && version === generation) invalidateUploaded();
    }
  }

  async function process(entry: UploadEntry) {
    const version = generation;
    const controller = new AbortController();
    controllers.set(entry.id, controller);
    entry.state = "running";
    entry.error = undefined;
    try {
      if (entry.assetId) {
        await finish(entry, entry.assetId, controller.signal, version);
        return;
      }
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
              translate(
                "服务器已完成此会话，但对应文件已不可用，请重新选择文件。",
              ),
            );
          await finish(entry, session.file.id, controller.signal, version);
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
      if (!entry.file) throw new Error(translate("请重新选择文件"));
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
        await finish(entry, session.file.id, controller.signal, version);
        return;
      }
      if (session.merging) {
        entry.phase = "verifying";
        session = await waitForMerge(session, controller.signal);
        if (session.status === "COMPLETED" && session.file) {
          await finish(entry, session.file.id, controller.signal, version);
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
      await finish(entry, result.file.id, controller.signal, version);
    } catch (error) {
      if (version !== generation || controller.signal.aborted) return;
      let failure = error;
      if (entry.sessionId && !entry.assetId) {
        try {
          const session = await mediaApi.uploadSession(
            entry.sessionId,
            controller.signal,
          );
          if (version !== generation) return;
          if (session.status === "COMPLETED" && session.file) {
            await finish(entry, session.file.id, controller.signal, version);
            return;
          }
        } catch (cause) {
          if (entry.assetId) failure = cause;
        }
      }
      if (version === generation && !controller.signal.aborted) {
        entry.state = "error";
        entry.error =
          entry.assetId && entry.albumId
            ? translate(
                "文件已上传，加入相册未完成：{value1}。重试不会重新上传文件。",
                { value1: getErrorMessage(failure) },
              )
            : getErrorMessage(failure);
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
          translate(
            "服务器仍在校验合并，可稍后继续；已上传的分片不会重复发送。",
          ),
        );
      await uploadDelay(3000, signal);
      const progress = await mediaApi.uploadProgress(session.id, signal);
      session = { ...session, ...progress };
      if (session.status === "COMPLETED")
        return { ...session, uploadedBytes: Number(session.size ?? 0) };
      if (!session.merging || session.expired)
        return mediaApi.uploadSession(session.id, signal);
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
    if (
      !["error", "paused"].includes(entry.state) ||
      (!entry.file && !entry.assetId)
    )
      return;
    entry.state = "queued";
    pump();
  }

  function cancel(entry: UploadEntry) {
    if (
      !["queued", "running", "paused", "error"].includes(entry.state) ||
      (entry.state === "running" && entry.phase === "album")
    )
      return;
    controllers.get(entry.id)?.abort();
    entry.state = "cancelled";
    entry.file = null;
    entry.digest = undefined;
    entry.error =
      entry.assetId && entry.albumId
        ? translate("已停止加入相册，文件仍保留在图库。")
        : undefined;
    if (entry.sessionId && !entry.assetId) {
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
          ) {
            if (rememberUploaded(entry, session.file.id)) invalidateUploaded();
            if (entry.albumId)
              entry.error = translate("已停止加入相册，文件仍保留在图库。");
            else entry.state = "done";
          }
        }
      });
    }
    pump();
  }

  function pause(entry: UploadEntry) {
    if (
      !["queued", "running"].includes(entry.state) ||
      (entry.state === "running" && entry.phase === "album")
    )
      return;
    entry.state = "paused";
    controllers.get(entry.id)?.abort();
    pump();
  }

  function clearFinished() {
    entries.value = entries.value.filter(
      (entry) =>
        ["queued", "running", "paused"].includes(entry.state) ||
        (entry.state === "error" && (entry.file || entry.assetId)),
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
    canUpload,
    chooseFiles,
    add,
    retry,
    pause,
    cancel,
    clearFinished,
    reset,
  };
});
