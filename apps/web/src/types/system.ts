export interface ExtensionCapability {
  id: string;
  name: string;
  category: string;
  builtin: boolean;
  description: string;
  detail: string;
}

export interface SystemCapabilities {
  storageProvider: string;
  searchMode: string;
  peopleMode: string;
  trashRetentionDays: number | null;
  pluginManagement: boolean;
  upload: { maxBytes: number; maxPixels: number; mimeTypes: string[] };
  extensions: ExtensionCapability[];
}
