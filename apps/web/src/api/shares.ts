import { request } from "./request";
import type {
  ShareLink,
  SharePage,
  ShareSaveResult,
  ShareTarget,
} from "@/types/shares";

const identifier = encodeURIComponent;
const publicOptions = { auth: false, referrerPolicy: "no-referrer" as const };

export const sharesApi = {
  list: (target: ShareTarget, signal?: AbortSignal) =>
    request<ShareLink[]>(
      `/shares?${new URLSearchParams({ kind: target.kind, targetId: target.targetId })}`,
      { signal },
    ),
  create: (target: ShareTarget, expiresInDays: number) =>
    request<ShareLink>("/shares", {
      method: "POST",
      body: { ...target, expiresInDays },
    }),
  revoke: (id: string) =>
    request<{ id: string }>(`/shares/${identifier(id)}`, { method: "DELETE" }),
  detail: (token: string, cursor?: string, signal?: AbortSignal) =>
    request<SharePage>(
      `/shares/${identifier(token)}${cursor ? `?cursor=${identifier(cursor)}` : ""}`,
      { ...publicOptions, signal },
    ),
  thumbnail: (token: string, assetId: string, signal?: AbortSignal) =>
    request<Blob>(
      `/shares/${identifier(token)}/assets/${identifier(assetId)}/thumbnail`,
      { ...publicOptions, responseType: "blob", signal },
    ),
  original: (token: string, assetId: string, signal?: AbortSignal) =>
    request<Blob>(
      `/shares/${identifier(token)}/assets/${identifier(assetId)}/file`,
      { ...publicOptions, responseType: "blob", signal, timeoutMs: 120_000 },
    ),
  save: (token: string, signal?: AbortSignal) =>
    request<ShareSaveResult>(`/shares/${identifier(token)}/save`, {
      method: "POST",
      signal,
      referrerPolicy: "no-referrer",
      timeoutMs: 120_000,
    }),
};
