/*
  Warnings:

  - You are about to drop the column `account` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_account_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "account";
