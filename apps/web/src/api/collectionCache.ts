import { ApiError, request, requestScope } from "./request";
import { sharedRead } from "./sharedRead";
import { translate } from "@/i18n";
import { updateAlbums, updateTags } from "@/composables/workspaceUpdates";
import type { Album, Tag } from "@/types/media";
import type { WorkspaceChange, WorkspaceResource } from "@/types/workspace";

function collectionCache<Data>(
  resource: "albums" | "tags",
  update: (value: Data, change: WorkspaceChange) => Data,
) {
  let cached: { value: Data; scope: number; expiresAt: number } | null = null;
  let revision = 0;
  return {
    async read(signal?: AbortSignal): Promise<Data> {
      if (signal?.aborted)
        throw new ApiError(translate("请求已取消"), 0, "ABORTED");
      const scope = requestScope();
      if (cached?.scope === scope && cached.expiresAt > Date.now()) {
        const value = cached.value;
        await Promise.resolve();
        if (signal?.aborted)
          throw new ApiError(translate("请求已取消"), 0, "ABORTED");
        if (scope !== requestScope())
          throw new ApiError(
            translate("登录状态已变化，请重试"),
            0,
            "AUTH_CHANGED",
          );
        return value;
      }
      const version = revision;
      const result = await sharedRead<Data>(
        JSON.stringify([scope, resource, version]),
        (signal) => request<Data>(`/${resource}`, { signal }),
        signal,
      );
      if (scope !== requestScope())
        throw new ApiError(
          translate("登录状态已变化，请重试"),
          0,
          "AUTH_CHANGED",
        );
      if (revision === version && scope === requestScope())
        cached = { value: result, scope, expiresAt: Date.now() + 30_000 };
      return result;
    },
    apply(change: WorkspaceChange) {
      revision += 1;
      if (cached?.scope === requestScope())
        cached.value = update(cached.value, change);
    },
    invalidate() {
      revision += 1;
      cached = null;
    },
  };
}

const albums = collectionCache<Album[]>("albums", updateAlbums);
const tags = collectionCache<Tag[]>("tags", updateTags);
export const readAlbums = albums.read;
export const readTags = tags.read;

export function updateCollectionCache(change: WorkspaceChange) {
  const assetVisibilityChanged =
    change.type === "assets" &&
    (change.removed || change.patch.deleted !== undefined);
  if (
    change.type === "album" ||
    change.type === "album-members" ||
    assetVisibilityChanged
  )
    albums.apply(change);
  if (
    change.type === "tag" ||
    change.type === "asset-tags" ||
    change.type === "asset-tags-batch" ||
    assetVisibilityChanged
  )
    tags.apply(change);
}

export function invalidateCollectionCache(resources: WorkspaceResource[]) {
  if (resources.includes("albums")) albums.invalidate();
  if (resources.includes("tags")) tags.invalidate();
}
