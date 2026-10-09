CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "token" VARCHAR(22) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "assetId" TEXT,
    "albumId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShareLink_one_target_check" CHECK (("assetId" IS NOT NULL)::integer + ("albumId" IS NOT NULL)::integer = 1)
);

CREATE TABLE "ShareSave" (
    "shareId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT,
    "albumId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareSave_pkey" PRIMARY KEY ("shareId", "userId")
);

CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");
CREATE INDEX "ShareLink_ownerId_createdAt_idx" ON "ShareLink"("ownerId", "createdAt");
CREATE INDEX "ShareLink_assetId_idx" ON "ShareLink"("assetId");
CREATE INDEX "ShareLink_albumId_idx" ON "ShareLink"("albumId");
CREATE INDEX "ShareSave_userId_idx" ON "ShareSave"("userId");
CREATE INDEX "ShareSave_assetId_idx" ON "ShareSave"("assetId");
CREATE INDEX "ShareSave_albumId_idx" ON "ShareSave"("albumId");

ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareSave" ADD CONSTRAINT "ShareSave_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "ShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareSave" ADD CONSTRAINT "ShareSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareSave" ADD CONSTRAINT "ShareSave_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FileNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShareSave" ADD CONSTRAINT "ShareSave_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;
