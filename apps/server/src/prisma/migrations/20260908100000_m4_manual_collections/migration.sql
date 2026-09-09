CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "ownerId" TEXT NOT NULL,
    "coverAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlbumAsset" (
    "albumId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlbumAsset_pkey" PRIMARY KEY ("albumId", "assetId")
);

CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetTag" (
    "assetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetTag_pkey" PRIMARY KEY ("assetId", "tagId")
);

CREATE UNIQUE INDEX "Album_ownerId_name_key" ON "Album"("ownerId", "name");
CREATE INDEX "Album_ownerId_createdAt_id_idx" ON "Album"("ownerId", "createdAt", "id");
CREATE INDEX "Album_coverAssetId_idx" ON "Album"("coverAssetId");
CREATE INDEX "AlbumAsset_assetId_idx" ON "AlbumAsset"("assetId");
CREATE UNIQUE INDEX "Tag_ownerId_name_key" ON "Tag"("ownerId", "name");
CREATE INDEX "AssetTag_tagId_idx" ON "AssetTag"("tagId");
CREATE INDEX "FileNode_ownerId_deleted_isFavorite_createdAt_id_idx" ON "FileNode"("ownerId", "deleted", "isFavorite", "createdAt", "id");

ALTER TABLE "Album" ADD CONSTRAINT "Album_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Album" ADD CONSTRAINT "Album_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "FileNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AlbumAsset" ADD CONSTRAINT "AlbumAsset_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumAsset" ADD CONSTRAINT "AlbumAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetTag" ADD CONSTRAINT "AssetTag_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetTag" ADD CONSTRAINT "AssetTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
