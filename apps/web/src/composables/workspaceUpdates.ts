import type { Album, AssetDetail, AssetSummary, Tag } from "@/types/media";
import type { WorkspaceChange } from "@/types/workspace";

export function updateAsset<Value extends AssetSummary>(
  asset: Value,
  change: WorkspaceChange,
): Value {
  if (change.type === "assets" && change.ids.includes(asset.id))
    return { ...asset, ...change.patch };
  if (change.type === "asset-tags-batch" && change.ids.includes(asset.id)) {
    const tags = change.removedTagId
      ? asset.tags.filter((tag) => tag.id !== change.removedTagId)
      : change.assignments?.[asset.id];
    return tags ? { ...asset, tags } : asset;
  }
  if (change.type === "asset-tags" && change.id === asset.id) {
    const tags = change.removedTagId
      ? asset.tags.filter((tag) => tag.id !== change.removedTagId)
      : change.tags;
    return { ...asset, tags };
  }
  if (change.type === "tag" && asset.tags.some((tag) => tag.id === change.id)) {
    const tags = asset.tags.filter((tag) => tag.id !== change.id);
    if (change.value && !tags.some((tag) => tag.id === change.value!.id))
      tags.push(change.value);
    tags.sort((left, right) => left.name.localeCompare(right.name));
    return { ...asset, tags };
  }
  return asset;
}

export function updateAssetDetail(
  asset: AssetDetail | null,
  change: WorkspaceChange,
): AssetDetail | null {
  if (!asset) return asset;
  if (
    change.type === "assets" &&
    change.removed &&
    change.ids.includes(asset.id)
  )
    return null;
  const updated = updateAsset(asset, change);
  if (
    change.type === "album" &&
    asset.albums.some((album) => album.id === change.id)
  ) {
    const albums = asset.albums.flatMap((album) =>
      album.id !== change.id
        ? [album]
        : change.value
          ? [{ id: change.value.id, name: change.value.name }]
          : [],
    );
    return { ...updated, albums };
  }
  if (change.type === "album-members" && change.ids.includes(asset.id)) {
    const albums = asset.albums.filter((album) => album.id !== change.album.id);
    if (change.added)
      albums.push({ id: change.album.id, name: change.album.name });
    return { ...updated, albums };
  }
  return updated;
}

export function updateAlbums(
  albums: Album[],
  change: WorkspaceChange,
): Album[] {
  if (
    change.type === "assets" &&
    (change.removed || change.patch.deleted !== undefined)
  ) {
    return albums.map((album) => {
      const affected = change.before.filter((asset) =>
        change.albumIds[asset.id]?.includes(album.id),
      );
      const delta = affected.reduce(
        (count, asset) =>
          count +
          (change.removed || (change.patch.deleted ?? asset.deleted) ? 0 : 1) -
          (asset.deleted ? 0 : 1),
        0,
      );
      if (!delta) return album;
      const coverRemoved =
        delta < 0 && affected.some((asset) => asset.id === album.coverAssetId);
      return {
        ...album,
        count: Math.max(0, album.count + delta),
        ...(coverRemoved ? { coverAssetId: null, coverUrl: null } : {}),
      };
    });
  }
  const value =
    change.type === "album"
      ? change.value
      : change.type === "album-members"
        ? change.album
        : undefined;
  if (value === undefined) return albums;
  const id = change.type === "album" ? change.id : value!.id;
  const updated = albums.filter((album) => album.id !== id);
  if (value) updated.push(value);
  return updated.sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
}

export function updateAlbumDetail<Value extends Album>(
  album: Value,
  change: WorkspaceChange,
): Value {
  const updated = updateAlbums([album], change).find(
    (entry) => entry.id === album.id,
  );
  return updated && updated !== album ? { ...album, ...updated } : album;
}

export function updateTags(tags: Tag[], change: WorkspaceChange): Tag[] {
  if (
    change.type === "assets" &&
    (change.removed || change.patch.deleted !== undefined)
  ) {
    return tags.map((tag) => {
      const affected = change.before.filter((asset) =>
        asset.tags.some((entry) => entry.id === tag.id),
      );
      const delta = affected.reduce(
        (count, asset) =>
          count +
          (change.removed || (change.patch.deleted ?? asset.deleted) ? 0 : 1) -
          (asset.deleted ? 0 : 1),
        0,
      );
      if (!delta) return tag;
      const coverRemoved =
        delta < 0 && affected.some((asset) => asset.id === tag.coverAssetId);
      return {
        ...tag,
        count: Math.max(0, tag.count + delta),
        ...(coverRemoved ? { coverAssetId: null } : {}),
      };
    });
  }
  const replacements =
    change.type === "tag"
      ? change.value
        ? [change.value]
        : []
      : change.type === "asset-tags" || change.type === "asset-tags-batch"
        ? change.tags
        : null;
  if (!replacements) return tags;
  const updated = new Map(tags.map((tag) => [tag.id, tag]));
  if (change.type === "tag") updated.delete(change.id);
  for (const tag of replacements) updated.set(tag.id, tag);
  return [...updated.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
}
