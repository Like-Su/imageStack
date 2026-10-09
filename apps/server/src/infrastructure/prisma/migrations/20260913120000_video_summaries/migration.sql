CREATE TYPE "VideoSummaryStage" AS ENUM ('TRANSCRIBING', 'SUMMARIZING');

CREATE TABLE "VideoSummary" (
    "assetId" TEXT NOT NULL,
    "status" "MediaProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "stage" "VideoSummaryStage" NOT NULL DEFAULT 'TRANSCRIBING',
    "transcript" TEXT,
    "segments" JSONB,
    "transcribedChunks" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT,
    "summary" TEXT,
    "model" TEXT,
    "sourceHash" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoSummary_pkey" PRIMARY KEY ("assetId")
);

CREATE TABLE "VideoSummaryEvent" (
    "id" BIGSERIAL NOT NULL,
    "assetId" TEXT NOT NULL,
    "status" "MediaProcessingStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoSummaryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoSummary_status_nextAttemptAt_idx" ON "VideoSummary"("status", "nextAttemptAt");
CREATE INDEX "VideoSummary_status_leaseUntil_idx" ON "VideoSummary"("status", "leaseUntil");
CREATE INDEX "VideoSummaryEvent_assetId_idx" ON "VideoSummaryEvent"("assetId");
ALTER TABLE "VideoSummary" ADD CONSTRAINT "VideoSummary_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoSummaryEvent" ADD CONSTRAINT "VideoSummaryEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "VideoSummary"("assetId") ON DELETE CASCADE ON UPDATE CASCADE;
