export interface ExtensionCapability {
  id: string;
  name: string;
  category: string;
  builtin: boolean;
  description: string;
  detail: string;
}

export interface StorageSpace {
  provider: string;
  scope: "filesystem" | "bucket";
  usedBytes: string;
  totalBytes: string | null;
  availableBytes: string | null;
}

export interface SystemCapabilities {
  storageProvider: string;
  storageProviders: string[];
  searchMode: string;
  peopleMode: string;
  trashRetentionDays: number | null;
  pluginManagement: boolean;
  upload: {
    maxBytes: number;
    imageMaxBytes: number;
    videoMaxBytes: number;
    fileMaxBytes: number;
    acceptsAnyFile: boolean;
    videoMaxDurationMs: number | null;
    maxPixels: number | null;
    maxFrames: number;
    extensions: string[];
    mimeTypes: string[];
  };
  extensions: ExtensionCapability[];
}
