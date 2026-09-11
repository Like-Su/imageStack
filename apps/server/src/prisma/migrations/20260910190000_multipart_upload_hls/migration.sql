ALTER TABLE "FileNode"
ADD COLUMN "hlsKey" TEXT,
ADD COLUMN "hlsSegmentCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "UploadSession"
ADD COLUMN "chunkSize" INTEGER,
ADD COLUMN "chunkCount" INTEGER,
ADD COLUMN "mergeToken" TEXT,
ADD COLUMN "mergeLeaseUntil" TIMESTAMP(3);

CREATE TABLE "UploadPart" (
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadPart_pkey" PRIMARY KEY ("sessionId", "index"),
    CONSTRAINT "UploadPart_sessionId_fkey" FOREIGN KEY ("sessionId")
        REFERENCES "UploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UploadPart_index_check" CHECK ("index" >= 0),
    CONSTRAINT "UploadPart_size_check" CHECK ("size" > 0 AND "size" <= 5242880)
);

CREATE UNIQUE INDEX "UploadPart_storageKey_key" ON "UploadPart"("storageKey");
CREATE INDEX "UploadSession_userId_hash_size_idx" ON "UploadSession"("userId", "hash", "size");
CREATE INDEX "UploadSession_status_createdAt_idx" ON "UploadSession"("status", "createdAt");
CREATE INDEX "FileNode_ownerId_hash_size_idx" ON "FileNode"("ownerId", "hash", "size");
