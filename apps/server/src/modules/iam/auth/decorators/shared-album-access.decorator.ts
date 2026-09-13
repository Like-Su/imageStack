import { SetMetadata } from '@nestjs/common';

export const SHARED_ALBUM_ACCESS_KEY = 'SHARED_ALBUM_ACCESS';

export interface SharedAlbumAccess {
  source: 'album' | 'album-query' | 'asset' | 'upload';
  permission: 'view' | 'addAssets' | 'edit' | 'removeAssets' | 'deleteAlbum';
}

export const AllowSharedAlbum = (
  source: SharedAlbumAccess['source'],
  permission: SharedAlbumAccess['permission'],
) =>
  SetMetadata(SHARED_ALBUM_ACCESS_KEY, {
    source,
    permission,
  } satisfies SharedAlbumAccess);
