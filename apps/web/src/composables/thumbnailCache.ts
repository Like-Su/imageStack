const maximumBytes = 24 * 1024 * 1024;
const maximumEntries = 80;
const lifetime = 60_000;
const entries = new Map<string, { blob: Blob; expiresAt: number }>();
let bytes = 0;

function remove(key: string) {
  const entry = entries.get(key);
  if (entry) bytes -= entry.blob.size;
  entries.delete(key);
}

export function cachedThumbnail(key: string) {
  const entry = entries.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    remove(key);
    return null;
  }
  entries.delete(key);
  entries.set(key, entry);
  return entry.blob;
}

export function cacheThumbnail(key: string, blob: Blob) {
  if (blob.size > maximumBytes) return;
  remove(key);
  entries.set(key, { blob, expiresAt: Date.now() + lifetime });
  bytes += blob.size;
  while (bytes > maximumBytes || entries.size > maximumEntries)
    remove(entries.keys().next().value!);
}

export function clearThumbnailCache() {
  entries.clear();
  bytes = 0;
}
