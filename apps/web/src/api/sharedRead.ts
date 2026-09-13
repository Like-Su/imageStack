import { ApiError } from "./request";
import { translate } from "@/i18n";

interface PendingRead {
  controller: AbortController;
  promise: Promise<unknown>;
  consumers: number;
  settled: boolean;
}

const pending = new Map<string, PendingRead>();

export function sharedRead<Data>(
  key: string,
  loader: (signal: AbortSignal) => Promise<Data>,
  signal?: AbortSignal,
): Promise<Data> {
  if (signal?.aborted)
    return Promise.reject(new ApiError(translate("请求已取消"), 0, "ABORTED"));
  let entry = pending.get(key);
  if (!entry) {
    const controller = new AbortController();
    const created: PendingRead = {
      controller,
      promise: Promise.resolve(),
      consumers: 0,
      settled: false,
    };
    created.promise = Promise.resolve()
      .then(() => loader(controller.signal))
      .finally(() => {
        created.settled = true;
        if (pending.get(key) === created) pending.delete(key);
      });
    entry = created;
    pending.set(key, entry);
  }
  const current = entry;
  current.consumers += 1;
  return new Promise<Data>((resolve, reject) => {
    let finished = false;
    const release = () => {
      if (finished) return false;
      finished = true;
      signal?.removeEventListener("abort", abort);
      current.consumers -= 1;
      if (!current.consumers && !current.settled) {
        if (pending.get(key) === current) pending.delete(key);
        current.controller.abort();
      }
      return true;
    };
    const abort = () => {
      if (release())
        reject(new ApiError(translate("请求已取消"), 0, "ABORTED"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    current.promise.then(
      (value) => {
        if (release()) resolve(value as Data);
      },
      (error: unknown) => {
        if (release()) reject(error);
      },
    );
  });
}

export function clearSharedReads() {
  for (const entry of pending.values()) entry.controller.abort();
  pending.clear();
}
