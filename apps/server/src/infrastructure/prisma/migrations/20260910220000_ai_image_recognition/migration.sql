CREATE TABLE "AssetRecognition" (
    "assetId" TEXT NOT NULL,
    "status" "MediaProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "ocrText" TEXT,
    "searchText" TEXT,
    "model" TEXT,
    "sourceHash" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "indexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssetRecognition_pkey" PRIMARY KEY ("assetId"),
    CONSTRAINT "AssetRecognition_assetId_fkey" FOREIGN KEY ("assetId")
        REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetRecognition_attempts_check" CHECK ("attempts" >= 0)
);

CREATE INDEX "AssetRecognition_status_nextAttemptAt_idx" ON "AssetRecognition"("status", "nextAttemptAt");
CREATE INDEX "AssetRecognition_status_leaseUntil_idx" ON "AssetRecognition"("status", "leaseUntil");
