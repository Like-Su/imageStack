import { Readable } from 'node:stream';
import { ZipFile } from 'yazl';
import type { FileNode } from '../../infrastructure/prisma/generated/prisma/client';
import type { StorageService } from '../../infrastructure/storage/storage.service';

export type ArchiveAsset = Pick<
  FileNode,
  | 'id'
  | 'name'
  | 'storageProvider'
  | 'storageBucket'
  | 'storageKey'
  | 'size'
  | 'mediaType'
  | 'createdAt'
>;

export function archiveEntryNames(fileNames: string[]) {
  const used = new Set<string>();
  return fileNames.map((fileName) => {
    let safeName =
      fileName
        .normalize('NFC')
        .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_')
        .trim()
        .replace(/[. ]+$/g, '') || 'file';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safeName)) {
      safeName = `_${safeName}`;
    }
    const extensionIndex = safeName.lastIndexOf('.');
    const suffix = extensionIndex > 0 ? safeName.slice(extensionIndex) : '';
    const extension = Buffer.byteLength(suffix, 'utf8') <= 60 ? suffix : '';
    const characters = Array.from(
      extension ? safeName.slice(0, -extension.length) : safeName,
    );
    while (Buffer.byteLength(characters.join('') + extension, 'utf8') > 240)
      characters.pop();
    const baseName = characters.join('');
    safeName = baseName + extension;
    let candidate = safeName;
    let index = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${baseName} (${index++})${extension}`;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export function createAssetArchive(
  storage: StorageService,
  assets: ArchiveAsset[],
): Readable {
  const archive = new ZipFile();
  const output = archive.outputStream as Readable;
  const inputs = new Set<Readable>();
  archive.on('error', (error: Error) => output.destroy(error));
  output.once('close', () => {
    if (!output.readableEnded)
      archive.emit('error', new Error('ZIP 下载已中断'));
    for (const input of inputs) input.destroy();
    inputs.clear();
  });
  const names = archiveEntryNames(assets.map((asset) => asset.name));
  assets.forEach((asset, index) => {
    archive.addReadStreamLazy(
      names[index],
      {
        size: Number(asset.size),
        mtime: asset.createdAt,
        compressionLevel:
          asset.mediaType === 'DOCUMENT' || asset.mediaType === 'OTHER' ? 6 : 0,
      },
      (callback) => {
        void (async () => {
          if (output.destroyed) throw new Error('ZIP 下载已中断');
          const opened = await storage.for(asset).read(asset.storageKey);
          if (output.destroyed || opened.stat.size !== asset.size) {
            opened.stream.destroy();
            throw new Error('ZIP 下载已中断或文件大小发生变化');
          }
          inputs.add(opened.stream);
          opened.stream.once('close', () => inputs.delete(opened.stream));
          opened.stream.once('error', (error: Error) =>
            archive.emit('error', error),
          );
          callback(null, opened.stream);
        })().catch((error: unknown) => callback(error, undefined));
      },
    );
  });
  archive.end();
  return output;
}
