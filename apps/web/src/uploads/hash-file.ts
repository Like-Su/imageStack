import { translate } from "@/i18n";
import { UPLOAD_CHUNK_BYTES } from "@/config/workspace";

export interface FileDigest {
  hash: string;
  chunkHashes: string[];
}

export function hashFile(
  file: File,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
): Promise<FileDigest> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException(translate("上传已暂停"), "AbortError"));
      return;
    }
    const worker = new Worker(
      new URL("./file-hash.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException(translate("上传已暂停"), "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (
      event: MessageEvent<
        | { type: "progress"; loaded: number }
        | ({ type: "complete" } & FileDigest)
        | { type: "error"; message: string }
      >,
    ) => {
      const result = event.data;
      if (result.type === "progress") onProgress(result.loaded);
      else {
        cleanup();
        if (result.type === "error")
          reject(new Error(translate(result.message)));
        else resolve({ hash: result.hash, chunkHashes: result.chunkHashes });
      }
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error(translate("文件指纹计算失败，请重试")));
    };
    worker.postMessage({ file, chunkSize: UPLOAD_CHUNK_BYTES });
  });
}
