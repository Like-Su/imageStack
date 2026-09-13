ALTER TABLE "Album" ADD COLUMN "shared" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AlbumMember" (
    "albumId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canAdd" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canRemove" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumMember_pkey" PRIMARY KEY ("albumId", "userId")
);

CREATE INDEX "AlbumMember_userId_albumId_idx" ON "AlbumMember"("userId", "albumId");

ALTER TABLE "AlbumMember" ADD CONSTRAINT "AlbumMember_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlbumMember" ADD CONSTRAINT "AlbumMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UploadSession" ADD COLUMN "albumId" TEXT;

CREATE INDEX "UploadSession_albumId_idx" ON "UploadSession"("albumId");

ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;
