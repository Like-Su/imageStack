import { Prisma } from '../../prisma/generated/prisma/client';

export async function referencedStorageKeys(
  prisma: Prisma.TransactionClient,
  keys: string[],
): Promise<Set<string>> {
  const unique = [...new Set(keys)];
  if (!unique.length) return new Set<string>();
  const values = Prisma.join(unique);
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    SELECT "storageKey" AS key FROM "FileNode" WHERE "storageKey" IN (${values})
    UNION SELECT "thumbnailKey" AS key FROM "FileNode" WHERE "thumbnailKey" IN (${values})
    UNION SELECT "previewKey" AS key FROM "FileNode" WHERE "previewKey" IN (${values})
    UNION SELECT "hlsKey" AS key FROM "FileNode" WHERE "hlsKey" IN (${values})
    UNION SELECT "storageKey" AS key FROM "UploadSession"
      WHERE "storageKey" IN (${values}) AND "status" IN ('PENDING', 'UPLOADING')
  `;
  return new Set(rows.map((row) => row.key));
}
