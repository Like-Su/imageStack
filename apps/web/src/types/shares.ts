export interface ShareTarget {
  kind: "asset" | "album";
  targetId: string;
}

export interface ShareLink {
  id: string;
  path: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface SharedImage {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  size: string | null;
  mimeType: string | null;
}

export interface SharePage {
  kind: ShareTarget["kind"];
  title: string;
  description: string | null;
  total: number;
  expiresAt: string | null;
  items: SharedImage[];
  nextCursor: string | null;
}

export interface ShareSaveResult {
  alreadySaved: boolean;
  count: number;
  assetId: string | null;
  albumId: string | null;
}
