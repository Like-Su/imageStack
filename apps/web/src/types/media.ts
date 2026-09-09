export type ProcessingStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";
export type MediaType = "IMAGE" | "VIDEO" | "AUDIO";

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
  durationMs: string | null;
  exif: Record<string, unknown> | null;
  albums: { id: string; name: string }[];
  fileUrl: string | null;
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
  file: UploadedFile | null;
}
