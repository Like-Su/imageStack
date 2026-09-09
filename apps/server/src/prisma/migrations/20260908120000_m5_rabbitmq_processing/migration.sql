ALTER TABLE "FileNode"
ADD COLUMN "processingAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "processingToken" TEXT,
ADD COLUMN "processingLeaseUntil" TIMESTAMP(3),
ADD COLUMN "processingNextAttemptAt" TIMESTAMP(3);

CREATE INDEX "FileNode_processingStatus_processingNextAttemptAt_idx"
ON "FileNode"("processingStatus", "processingNextAttemptAt");

CREATE INDEX "FileNode_processingStatus_processingLeaseUntil_idx"
ON "FileNode"("processingStatus", "processingLeaseUntil");
