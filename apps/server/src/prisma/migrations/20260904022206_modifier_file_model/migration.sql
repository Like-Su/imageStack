/*
  Warnings:

  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fileId,userId,access]` on the table `FilePermission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[permissionName]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[permissionCode]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdById` to the `FileShare` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "FilePermission_fileId_userId_key";

-- AlterTable
ALTER TABLE "FileNode" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "storageBucket" TEXT,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "FileShare" ADD COLUMN     "createdById" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerified",
ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE INDEX "FileNode_ownerId_parentId_idx" ON "FileNode"("ownerId", "parentId");

-- CreateIndex
CREATE INDEX "FilePermission_userId_idx" ON "FilePermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FilePermission_fileId_userId_access_key" ON "FilePermission"("fileId", "userId", "access");

-- CreateIndex
CREATE INDEX "FileShare_fileId_idx" ON "FileShare"("fileId");

-- CreateIndex
CREATE INDEX "FileShare_createdById_idx" ON "FileShare"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_permissionName_key" ON "Permission"("permissionName");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_permissionCode_key" ON "Permission"("permissionCode");

-- CreateIndex
CREATE INDEX "UploadSession_userId_status_idx" ON "UploadSession"("userId", "status");
