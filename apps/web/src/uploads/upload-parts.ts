import { translate } from "@/i18n";
import { blake3 } from "hash-wasm";
import { mediaApi } from "@/api/media";
import { ApiError } from "@/api/request";
import {
  UPLOAD_CHUNK_BYTES,
  UPLOAD_CHUNK_CONCURRENCY,
} from "@/config/workspace";
import type { UploadSession } from "@/types/media";
import type { FileDigest } from "./hash-file";

export function uploadDelay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException(translate("上传已暂停"), "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException(translate("上传已暂停"), "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function retryPart(action: () => Promise<unknown>, signal: AbortSignal) {
  for (let attempt = 0; ; attempt += 1) {
    signal.throwIfAborted();
    try {
      await action();
      return;
    } catch (error) {
      if (
        signal.aborted ||
        attempt >= 3 ||
        !(error instanceof ApiError) ||
        ![0, 408, 429, 500, 502, 503, 504].includes(error.status) ||
        error.code === "AUTH_CHANGED"
      )
        throw error;
      await uploadDelay(
        Math.max(1000 * 2 ** attempt, (error.retryAfter ?? 0) * 1000),
        signal,
      );
    }
  }
}

export async function uploadParts(
  file: File,
  session: UploadSession,
  digest: FileDigest,
  signal: AbortSignal,
  onProgress: (uploadedBytes: number) => void,
) {
  const { chunkSize, chunkCount } = session;
  if (
    !chunkSize ||
    !chunkCount ||
    chunkCount !== Math.ceil(file.size / chunkSize)
  )
    throw new Error(translate("服务端返回的分片配置无效"));
  const uploaded = new Set(session.uploadedParts);
  const pending = Array.from(
    { length: chunkCount },
    (_, index) => index,
  ).filter((index) => !uploaded.has(index));
  let uploadedBytes = session.uploadedBytes;
  onProgress(uploadedBytes);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  signal.addEventListener("abort", abort, { once: true });
  const workers = Array.from(
    { length: Math.min(UPLOAD_CHUNK_CONCURRENCY, pending.length) },
    async () => {
      for (;;) {
        controller.signal.throwIfAborted();
        const index = pending.shift();
        if (index === undefined) return;
        const chunk = file.slice(index * chunkSize, (index + 1) * chunkSize);
        const hash =
          chunkSize === UPLOAD_CHUNK_BYTES
            ? digest.chunkHashes[index]
            : await blake3(new Uint8Array(await chunk.arrayBuffer()));
        if (!hash) throw new Error(translate("分片指纹缺失，请重新选择文件"));
        await retryPart(
          () =>
            mediaApi.uploadPart(
              session.id,
              index,
              chunk,
              hash,
              controller.signal,
            ),
          controller.signal,
        );
        uploadedBytes += chunk.size;
        onProgress(uploadedBytes);
      }
    },
  );
  try {
    await Promise.all(workers);
  } catch (error) {
    controller.abort();
    await Promise.allSettled(workers);
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
