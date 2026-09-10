import { request } from "./request";
import { API_BASE_URL } from "@/config/api";
import type {
  Album,
  AlbumDetail,
  AssetDetail,
  AssetQuery,
  AssetSummary,
  AssetTag,
  CursorPage,
  LibraryOverview,
  MediaStreamTicket,
  PlacesResult,
  SearchResult,
  Tag,
  UploadedFile,
  UploadSession,
} from "@/types/media";

function queryString(query: object = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  }
  return params.size ? `?${params}` : "";
}

const identifier = encodeURIComponent;
export function mediaStreamUrl(path: string) {
  if (!path.startsWith("/assets/")) throw new Error("媒体播放地址无效");
  return `${API_BASE_URL}${path}`;
}
const originalFile = (assetId: string, signal?: AbortSignal) =>
  request<Blob>(`/assets/${identifier(assetId)}/file`, {
    signal,
    responseType: "blob",
    timeoutMs: 660_000,
  });

export const mediaApi = {
  overview: (signal?: AbortSignal) =>
    request<LibraryOverview>("/assets/overview", { signal }),
  assets: (query: AssetQuery = {}, signal?: AbortSignal, trash = false) =>
    request<CursorPage<AssetSummary>>(
      `/assets${trash ? "/trash" : ""}${queryString(query)}`,
      { signal },
    ),
  detail: (assetId: string, signal?: AbortSignal, trash = false) =>
    request<AssetDetail>(
      `/assets/${trash ? "trash/" : ""}${identifier(assetId)}`,
      { signal },
    ),
  thumbnail: (assetId: string, trash: boolean, signal?: AbortSignal) =>
    request<Blob>(
      `/assets/${trash ? "trash/" : ""}${identifier(assetId)}/thumbnail?size=sm`,
      { signal, responseType: "blob" },
    ),
  original: originalFile,
  streamTicket: (
    assetId: string,
    kind: MediaStreamTicket["kind"],
    signal?: AbortSignal,
  ) =>
    request<MediaStreamTicket>(`/assets/${identifier(assetId)}/stream-ticket`, {
      method: "POST",
      body: { kind },
      signal,
    }),
  preview: (assetId: string, signal?: AbortSignal) =>
    request<Blob>(`/assets/${identifier(assetId)}/preview`, {
      signal,
      responseType: "blob",
      timeoutMs: 660_000,
    }),
  favorite: (assetId: string, favorite: boolean) =>
    request<{ id: string; isFavorite: boolean }>(
      `/assets/${identifier(assetId)}/favorite`,
      { method: favorite ? "POST" : "DELETE" },
    ),
  trash: (ids: string[]) =>
    request<{ count: number }>("/assets", { method: "DELETE", body: { ids } }),
  restore: (ids: string[]) =>
    request<{ count: number }>("/assets/restore", {
      method: "POST",
      body: { ids },
    }),
  purge: (ids: string[]) =>
    request<{ count: number; cleanupPending: number }>("/assets/trash", {
      method: "DELETE",
      body: { ids },
    }),
  retry: (assetId: string) =>
    request<{ id: string; status: "PENDING"; enqueued: boolean }>(
      `/assets/${identifier(assetId)}/retry`,
      { method: "POST" },
    ),
  search: (text: string, query: AssetQuery = {}, signal?: AbortSignal) =>
    request<SearchResult>(
      `/search${queryString({ ...query, q: text, mode: "keyword" })}`,
      { signal },
    ),
  places: (signal?: AbortSignal) =>
    request<PlacesResult>("/assets/places", { signal }),
  albums: (signal?: AbortSignal) => request<Album[]>("/albums", { signal }),
  album: (albumId: string, signal?: AbortSignal) =>
    request<AlbumDetail>(`/albums/${identifier(albumId)}?limit=1`, { signal }),
  createAlbum: (body: { name: string; description?: string }) =>
    request<Album>("/albums", { method: "POST", body }),
  updateAlbum: (
    albumId: string,
    body: {
      name?: string;
      description?: string | null;
      coverAssetId?: string | null;
    },
  ) =>
    request<Album>(`/albums/${identifier(albumId)}`, { method: "PATCH", body }),
  deleteAlbum: (albumId: string) =>
    request<{ id: string }>(`/albums/${identifier(albumId)}`, {
      method: "DELETE",
    }),
  addToAlbum: (albumId: string, ids: string[]) =>
    request<{ count: number }>(`/albums/${identifier(albumId)}/assets`, {
      method: "POST",
      body: { ids },
    }),
  removeFromAlbum: (albumId: string, ids: string[]) =>
    request<{ count: number }>(`/albums/${identifier(albumId)}/assets`, {
      method: "DELETE",
      body: { ids },
    }),
  tags: (signal?: AbortSignal) => request<Tag[]>("/tags", { signal }),
  createTag: (name: string) =>
    request<Tag>("/tags", { method: "POST", body: { name } }),
  updateTag: (
    tagId: string,
    body: { name: string } | { mergeIntoId: string },
  ) => request<Tag>(`/tags/${identifier(tagId)}`, { method: "PATCH", body }),
  deleteTag: (tagId: string) =>
    request<{ id: string }>(`/tags/${identifier(tagId)}`, { method: "DELETE" }),
  addTags: (assetId: string, names: string[]) =>
    request<{ tags: AssetTag[] }>(`/assets/${identifier(assetId)}/tags`, {
      method: "POST",
      body: { names },
    }),
  removeTag: (assetId: string, tagId: string) =>
    request<{ count: number }>(
      `/assets/${identifier(assetId)}/tags/${identifier(tagId)}`,
      { method: "DELETE" },
    ),
  createUpload: (file: File, hash: string, signal?: AbortSignal) =>
    request<UploadSession>("/uploads/sessions", {
      method: "POST",
      body: { fileName: file.name, size: file.size, hash },
      signal,
    }),
  uploadSession: (sessionId: string, signal?: AbortSignal) =>
    request<UploadSession>(`/uploads/sessions/${identifier(sessionId)}`, {
      signal,
    }),
  uploadPart: (
    sessionId: string,
    index: number,
    chunk: Blob,
    hash: string,
    signal?: AbortSignal,
  ) =>
    request<{ index: number; size: number; hash: string }>(
      `/uploads/sessions/${identifier(sessionId)}/parts/${index}`,
      {
        method: "PUT",
        body: chunk,
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Chunk-Hash": hash,
        },
        signal,
        timeoutMs: 120_000,
      },
    ),
  completeUpload: (sessionId: string, signal?: AbortSignal) =>
    request<{ sessionId: string; status: "COMPLETED"; file: UploadedFile }>(
      `/uploads/sessions/${identifier(sessionId)}/complete`,
      { method: "POST", signal, timeoutMs: 660_000 },
    ),
  cancelUpload: (sessionId: string) =>
    request<{ id: string; status: "CANCELLED" }>(
      `/uploads/sessions/${identifier(sessionId)}`,
      { method: "DELETE" },
    ),
  upload: (sessionId: string, file: File, signal?: AbortSignal) =>
    request<{ sessionId: string; status: "COMPLETED"; file: UploadedFile }>(
      `/uploads/sessions/${identifier(sessionId)}/content`,
      {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/octet-stream" },
        signal,
        timeoutMs: 660_000,
      },
    ),
};
