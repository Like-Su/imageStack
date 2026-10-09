import { translate } from "@/i18n";
import { request, requestScope } from "./request";
import { sharedRead } from "./sharedRead";
import { readAlbums, readTags } from "./collectionCache";
import { API_BASE_URL } from "@/config/api";
import type {
  Album,
  AlbumMember,
  AlbumMemberPermissions,
  ArchiveDownloadTicket,
  AssetDetail,
  AssetQuery,
  AssetSummary,
  AssetTagBatch,
  ConfirmAssetTagsInput,
  AiIndexStatus,
  CursorPage,
  LibraryOverview,
  ImageRecognition,
  MediaStreamTicket,
  PlacesResult,
  SearchResult,
  Tag,
  UploadCompletion,
  UploadSession,
  VideoSummaryDetail,
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
  if (!path.startsWith("/assets/"))
    throw new Error(translate("媒体播放地址无效"));
  return `${API_BASE_URL}${path}`;
}
const originalFile = (assetId: string, signal?: AbortSignal) =>
  request<Blob>(`/assets/${identifier(assetId)}/file`, {
    signal,
    responseType: "blob",
    timeoutMs: 660_000,
  });

const readVideoSummary = (
  assetId: string,
  includeTranscript: boolean,
  signal?: AbortSignal,
) =>
  sharedRead(
    JSON.stringify([
      "video-summary",
      requestScope(),
      assetId,
      includeTranscript,
    ]),
    (sharedSignal) =>
      request<VideoSummaryDetail>(
        `/video-summaries/assets/${identifier(assetId)}?includeTranscript=${includeTranscript}`,
        { signal: sharedSignal },
      ),
    signal,
  );

export const mediaApi = {
  overview: (signal?: AbortSignal) =>
    request<LibraryOverview>("/assets/overview", { signal }),
  assets: (query: AssetQuery = {}, signal?: AbortSignal, trash = false) =>
    request<CursorPage<AssetSummary>>(
      `/assets${trash ? "/trash" : ""}${queryString(query)}`,
      { signal },
    ),
  trashIds: (cursor?: string, signal?: AbortSignal) =>
    request<CursorPage<{ id: string }>>(
      `/assets/trash/ids${queryString({ cursor })}`,
      { signal },
    ),
  detail: (assetId: string, signal?: AbortSignal, trash = false) =>
    request<AssetDetail>(
      `/assets/${trash ? "trash/" : ""}${identifier(assetId)}`,
      { signal },
    ),
  renameAsset: (assetId: string, name: string, signal?: AbortSignal) =>
    request<Pick<AssetSummary, "id" | "name" | "updatedAt">>(
      `/assets/${identifier(assetId)}`,
      { method: "PATCH", body: { name }, signal },
    ),
  thumbnail: (assetId: string, trash: boolean, signal?: AbortSignal) =>
    request<Blob>(
      `/assets/${trash ? "trash/" : ""}${identifier(assetId)}/thumbnail?size=sm`,
      { signal, responseType: "blob" },
    ),
  original: originalFile,
  archiveTicket: (ids: string[], signal?: AbortSignal) =>
    request<ArchiveDownloadTicket>("/assets/downloads/archive-ticket", {
      method: "POST",
      body: { ids },
      signal,
      timeoutMs: 120_000,
    }),
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
  aiStatus: (signal?: AbortSignal) =>
    request<AiIndexStatus>("/ai/status", { signal }),
  videoSummary: (assetId: string, signal?: AbortSignal) =>
    readVideoSummary(assetId, false, signal),
  videoTranscript: (assetId: string, signal?: AbortSignal) =>
    readVideoSummary(assetId, true, signal),
  summarizeVideo: (assetId: string, signal?: AbortSignal) =>
    request<{ queued: number; detail: VideoSummaryDetail }>(
      `/video-summaries/assets/${identifier(assetId)}`,
      { method: "POST", signal },
    ),
  recognition: (assetId: string, signal?: AbortSignal) =>
    request<ImageRecognition | null>(`/ai/assets/${identifier(assetId)}`, {
      signal,
    }),
  indexImages: (ids?: string[]) =>
    request<{ queued: number }>("/ai/index", {
      method: "POST",
      body: ids ? { ids } : {},
    }),
  places: (signal?: AbortSignal) =>
    request<PlacesResult>("/assets/places", { signal }),
  albums: readAlbums,
  album: (albumId: string, signal?: AbortSignal) =>
    request<Album>(`/albums/${identifier(albumId)}/summary`, { signal }),
  createAlbum: (body: {
    name: string;
    description?: string;
    shared?: boolean;
    coverImage?: string | null;
  }) => request<Album>("/albums", { method: "POST", body }),
  updateAlbum: (
    albumId: string,
    body: {
      name?: string;
      description?: string | null;
      coverAssetId?: string | null;
      coverImage?: string | null;
    },
  ) =>
    request<Album>(`/albums/${identifier(albumId)}`, { method: "PATCH", body }),
  deleteAlbum: (albumId: string) =>
    request<{ id: string }>(`/albums/${identifier(albumId)}`, {
      method: "DELETE",
    }),
  addToAlbum: (albumId: string, ids: string[], signal?: AbortSignal) =>
    request<{ count: number; album: Album }>(
      `/albums/${identifier(albumId)}/assets`,
      {
        method: "POST",
        body: { ids },
        signal,
      },
    ),
  removeFromAlbum: (albumId: string, ids: string[]) =>
    request<{ count: number; album: Album }>(
      `/albums/${identifier(albumId)}/assets`,
      {
        method: "DELETE",
        body: { ids },
      },
    ),
  renameAlbumAsset: (
    albumId: string,
    assetId: string,
    name: string,
    signal?: AbortSignal,
  ) =>
    request<{ id: string; name: string; updatedAt: string }>(
      `/albums/${identifier(albumId)}/assets/${identifier(assetId)}`,
      { method: "PATCH", body: { name }, signal },
    ),
  albumMembers: (albumId: string, signal?: AbortSignal) =>
    request<AlbumMember[]>(`/albums/${identifier(albumId)}/members`, {
      signal,
    }),
  inviteAlbumMember: (
    albumId: string,
    body: AlbumMemberPermissions & { email: string },
    signal?: AbortSignal,
  ) =>
    request<{ member: AlbumMember; album: Album }>(
      `/albums/${identifier(albumId)}/members`,
      {
        method: "POST",
        body,
        signal,
      },
    ),
  updateAlbumMember: (
    albumId: string,
    userId: string,
    body: AlbumMemberPermissions,
    signal?: AbortSignal,
  ) =>
    request<{ member: AlbumMember; album: Album }>(
      `/albums/${identifier(albumId)}/members/${identifier(userId)}`,
      {
        method: "PATCH",
        body,
        signal,
      },
    ),
  removeAlbumMember: (albumId: string, userId: string, signal?: AbortSignal) =>
    request<{ userId: string; album: Album }>(
      `/albums/${identifier(albumId)}/members/${identifier(userId)}`,
      {
        method: "DELETE",
        signal,
      },
    ),
  tags: readTags,
  addTagsBatch: (ids: string[], names: string[]) =>
    request<AssetTagBatch>("/tags/assets", {
      method: "POST",
      body: { ids, names },
    }),
  removeTagBatch: (ids: string[], tagId: string) =>
    request<{ count: number; tag: Tag }>(`/tags/${identifier(tagId)}/assets`, {
      method: "DELETE",
      body: { ids },
    }),
  tag: (tagId: string, signal?: AbortSignal) =>
    request<Tag>(`/tags/${identifier(tagId)}`, { signal }),
  createTag: (name: string) =>
    request<Tag>("/tags", { method: "POST", body: { name } }),
  updateTag: (
    tagId: string,
    body: { name: string } | { mergeIntoId: string },
  ) => request<Tag>(`/tags/${identifier(tagId)}`, { method: "PATCH", body }),
  deleteTag: (tagId: string) =>
    request<{ id: string }>(`/tags/${identifier(tagId)}`, { method: "DELETE" }),
  addTags: (assetId: string, names: string[]) =>
    request<{ tags: Tag[]; createdCount: number }>(
      `/assets/${identifier(assetId)}/tags`,
      {
        method: "POST",
        body: { names },
      },
    ),
  confirmTags: (
    assetId: string,
    body: ConfirmAssetTagsInput,
    signal?: AbortSignal,
  ) =>
    request<AssetTagBatch>(`/assets/${identifier(assetId)}/tags/confirm`, {
      method: "POST",
      body,
      signal,
    }),
  removeTag: (assetId: string, tagId: string) =>
    request<{ count: number; tag: Tag }>(
      `/assets/${identifier(assetId)}/tags/${identifier(tagId)}`,
      { method: "DELETE" },
    ),
  createUpload: (
    file: File,
    hash: string,
    signal?: AbortSignal,
    albumId?: string,
  ) =>
    request<UploadSession>("/uploads/sessions", {
      method: "POST",
      body: { fileName: file.name, size: file.size, hash, albumId },
      signal,
    }),
  uploadSession: (sessionId: string, signal?: AbortSignal) =>
    request<UploadSession>(`/uploads/sessions/${identifier(sessionId)}`, {
      signal,
    }),
  uploadProgress: (sessionId: string, signal?: AbortSignal) =>
    request<
      Pick<UploadSession, "status" | "expired" | "merging" | "file" | "albumId">
    >(`/uploads/sessions/${identifier(sessionId)}/progress`, { signal }),
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
    request<UploadCompletion>(
      `/uploads/sessions/${identifier(sessionId)}/complete`,
      { method: "POST", signal, timeoutMs: 660_000 },
    ),
  cancelUpload: (sessionId: string) =>
    request<{ id: string; status: "CANCELLED" }>(
      `/uploads/sessions/${identifier(sessionId)}`,
      { method: "DELETE" },
    ),
  upload: (sessionId: string, file: File, signal?: AbortSignal) =>
    request<UploadCompletion>(
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
