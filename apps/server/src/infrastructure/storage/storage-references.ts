import { Prisma } from '../prisma/generated/prisma/client';
import type { StorageLocation } from './storage.provider';

export async function referencedStorageKeys(
  prisma: Prisma.TransactionClient,
  keys: string[],
  location: StorageLocation,
): Promise<Set<string>> {
  const unique = [...new Set(keys)];
  if (!unique.length) return new Set<string>();
  const values = Prisma.join(unique);
  const scope = Prisma.sql`"storageProvider" = ${location.storageProvider}::"StorageProviderType"
    AND "storageBucket" IS NOT DISTINCT FROM ${location.storageBucket}::text`;
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    SELECT "storageKey" AS key FROM "FileNode" WHERE ${scope} AND "storageKey" IN (${values})
    UNION SELECT "thumbnailKey" AS key FROM "FileNode" WHERE ${scope} AND "thumbnailKey" IN (${values})
    UNION SELECT "previewKey" AS key FROM "FileNode" WHERE ${scope} AND "previewKey" IN (${values})
    UNION SELECT "hlsKey" AS key FROM "FileNode" WHERE ${scope} AND "hlsKey" IN (${values})
    UNION SELECT "storageKey" AS key FROM "UploadSession"
      WHERE ${scope} AND "storageKey" IN (${values}) AND "status" IN ('PENDING', 'UPLOADING')
  `;
  return new Set(rows.map((row) => row.key));
}
