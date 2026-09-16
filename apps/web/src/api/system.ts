import { request } from "./request";
import type { StorageSpace, SystemCapabilities } from "@/types/system";

export const systemApi = {
  capabilities: (signal?: AbortSignal) =>
    request<SystemCapabilities>("/system/capabilities", { signal }),
  storage: (signal?: AbortSignal) =>
    request<StorageSpace>("/system/storage", { signal }),
};
