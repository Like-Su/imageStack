import type { Album, AssetDetail, AssetSummary, AssetTag, Tag } from "./media";
import type { AdminRecord } from "./iam";

export type WorkspaceResource =
  | "assets"
  | "search"
  | "admin"
  | "albums"
  | "tags"
  | "places"
  | "ai"
  | "video-summaries"
  | "overview";

export type WorkspaceChange =
  | {
      type: "asset-tags-batch";
      ids: string[];
      tags: Tag[];
      assignments?: Record<string, AssetTag[]>;
      removedTagId?: string;
    }
  | { type: "admin"; before: AdminRecord | null; value: AdminRecord | null }
  | {
      type: "assets";
      ids: string[];
      patch: Partial<AssetDetail>;
      before: AssetSummary[];
      albumIds: Record<string, string[]>;
      removed?: boolean;
    }
  | { type: "album"; id: string; value: Album | null }
  | {
      type: "album-members";
      album: Album;
      ids: string[];
      added: boolean;
    }
  | { type: "tag"; id: string; value: Tag | null }
  | { type: "asset-tags"; id: string; tags: Tag[]; removedTagId?: string };
