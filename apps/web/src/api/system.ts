import { request } from "./request";
import type { SystemCapabilities } from "@/types/system";

export const systemApi = {
  capabilities: (signal?: AbortSignal) =>
    request<SystemCapabilities>("/system/capabilities", { signal }),
};
