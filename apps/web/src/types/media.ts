export type ProcessingStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";
export type MediaType = "IMAGE" | "VIDEO" | "AUDIO";

export interface VideoSummary {
  status: ProcessingStatus;
  stage: "TRANSCRIBING" | "SUMMARIZING";
  transcript: string | null;
  segments: { start: number; end: number; text: string }[] | null;
  transcribedChunks: number;
  language: string | null;
  summary: string | null;
  model: string | null;
  error: string | null;
  attempts: number;
  nextAttemptAt: string | null;
  completedAt: string | null;
}

export interface VideoSummaryDetail {
  configured: boolean;
  configurationError: string | null;
  autoSummarize: boolean;
  result: VideoSummary | null;
}

export interface ImageRecognition {
  status: ProcessingStatus;
  description: string | null;
  keywords: string[];
  ocrText: string | null;
  model: string | null;
  error: string | null;
  attempts: number;
  indexedAt: string | null;
  nextAttemptAt: string | null;
}

export interface AiIndexStatus {
  configured: boolean;
  configurationError: string | null;
  model: string | null;
  autoIndex: boolean;
  total: number;
  unindexed: number;
  counts: Record<ProcessingStatus, number>;
  batchSize: number;
}

export interface AssetTag {
  id: string;
  name: string;
  source: "MANUAL";
}

export interface AssetSummary {
  id: string;
  name: string;
  type: MediaType;
  status: ProcessingStatus;
  processingError: string | null;
  processingAttempts: number;
  nextAttemptAt: string | null;
  size: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationMs: string | null;
  takenAt: string | null;
  isFavorite: boolean;
  deleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: AssetTag[];
  thumbUrl: string;
}

export interface AssetDetail extends AssetSummary {
  hashAlgorithm: string | null;
  hash: string | null;
  exif: Record<string, unknown> | null;
  albums: { id: string; name: string }[];
  fileUrl: string | null;
  previewUrl: string | null;
}

export interface CursorPage<Item> {
  items: Item[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface AssetQuery {
  type?: "image" | "video" | "audio";
  timeField?: "createdAt" | "takenAt";
  year?: number;
  from?: string;
  to?: string;
  status?: ProcessingStatus;
  favorite?: boolean;
  uncategorized?: boolean;
  minSize?: number;
  albumId?: string;
  tagId?: string;
  tag?: string;
  placeId?: string;
  cursor?: string;
  limit?: number;
}

export interface LibraryOverview {
  total: number;
  favorites: number;
  albums: number;
  tags: number;
  trash: number;
  bytes: string;
  trashBytes: string;
  statuses: Record<ProcessingStatus, number>;
}

export interface Album {
  id: string;
  name: string;
  description: string | null;
  coverAssetId: string | null;
  coverUrl: string | null;
  count: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlbumDetail extends Album {
  assets: CursorPage<AssetSummary>;
}

export interface Tag extends AssetTag {
  count: number;
  coverAssetId: string | null;
}

export interface AssetTagBatch {
  assets: { id: string; tagIds: string[] }[];
  tags: Tag[];
  createdCount: number;
}

export interface SearchResult extends CursorPage<{
  asset: AssetSummary;
  score: null;
  matchedBy: string[];
}> {
  mode: "keyword";
  tookMs: number;
  parsed: null;
}

export interface Place {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
}

export interface PlacesResult {
  items: Place[];
  locatedAssets: number;
  totalPlaces: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: string | null;
  mimeType: string | null;
  mediaType: MediaType;
  durationMs: string | null;
  hash: string | null;
  width: number | null;
  height: number | null;
  processingStatus: ProcessingStatus | null;
  createdAt: string;
}

export interface UploadSession {
  id: string;
  status: "PENDING" | "UPLOADING" | "COMPLETED" | "FAILED" | "CANCELLED";
  fileName: string;
  size: string | null;
  expiresAt: string;
  expired: boolean;
  mode: "DIRECT" | "CHUNKED";
  chunkSize: number | null;
  chunkCount: number | null;
  uploadedParts: number[];
  uploadedBytes: number;
  merging: boolean;
  instant: boolean;
  file: UploadedFile | null;
}

export interface MediaStreamTicket {
  path: string;
  expiresAt: string;
  kind: "hls" | "original" | "download";
}
