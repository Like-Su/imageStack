CREATE TABLE "UserPermission" (
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("userId", "permissionId")
);

CREATE INDEX "UserPermission_permissionId_idx" ON "UserPermission"("permissionId");

ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Role_description_key";
