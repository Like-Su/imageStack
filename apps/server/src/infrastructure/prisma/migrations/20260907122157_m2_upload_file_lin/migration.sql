/*
  Warnings:

  - A unique constraint covering the columns `[fileId]` on the table `UploadSession` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StorageProviderType" AS ENUM ('LOCAL_FS');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "MediaProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ContentHashAlgorithm" AS ENUM ('BLAKE3');

-- AlterTable
ALTER TABLE "FileNode" ADD COLUMN     "durationMs" BIGINT,
ADD COLUMN     "exif" JSONB,
ADD COLUMN     "hash" VARCHAR(64),
ADD COLUMN     "hashAlgorithm" "ContentHashAlgorithm",
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mediaType" "MediaType",
ADD COLUMN     "previewKey" TEXT,
ADD COLUMN     "processingError" TEXT,
ADD COLUMN     "processingStatus" "MediaProcessingStatus",
ADD COLUMN     "storageProvider" "StorageProviderType",
ADD COLUMN     "takenAt" TIMESTAMP(3),
ADD COLUMN     "thumbnailKey" TEXT,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "UploadSession" ADD COLUMN     "fileId" TEXT;

-- CreateIndex
CREATE INDEX "FileNode_storageProvider_storageKey_idx" ON "FileNode"("storageProvider", "storageKey");

-- CreateIndex
CREATE INDEX "FileNode_ownerId_deleted_createdAt_id_idx" ON "FileNode"("ownerId", "deleted", "createdAt", "id");

-- CreateIndex
CREATE INDEX "FileNode_processingStatus_idx" ON "FileNode"("processingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_fileId_key" ON "UploadSession"("fileId");

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
