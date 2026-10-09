import type { ConfigService } from '@nestjs/config';

export const IMAGE_MAX_FRAMES = 1000;

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/apng',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];

export const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
];

export const MEDIA_MIME_TYPES = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES];

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'avif' | 'svg';
export type VideoFormat = 'mp4' | 'mov' | 'mkv';
export type MediaFormat = ImageFormat | VideoFormat;

const fileFormats = {
  AUDIO: {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
  },
  DOCUMENT: {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    odp: 'application/vnd.oasis.opendocument.presentation',
    rtf: 'application/rtf',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    epub: 'application/epub+zip',
  },
  ARCHIVE: {
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    tgz: 'application/gzip',
    bz2: 'application/x-bzip2',
    xz: 'application/x-xz',
    zst: 'application/zstd',
  },
} as const;

export function generalFileFormat(fileName: string) {
  const extension = /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase() ?? '';
  for (const mediaType of ['AUDIO', 'DOCUMENT', 'ARCHIVE'] as const) {
    const mimeTypes: Record<string, string> = fileFormats[mediaType];
    if (Object.prototype.hasOwnProperty.call(mimeTypes, extension)) {
      return { mediaType, mimeType: mimeTypes[extension] };
    }
  }
  return { mediaType: 'OTHER' as const, mimeType: 'application/octet-stream' };
}

export const FILE_EXTENSIONS = Object.values(fileFormats).flatMap((formats) =>
  Object.keys(formats).map((extension) => `.${extension}`),
);

export const FILE_MIME_TYPES = [
  ...new Set(
    Object.values(fileFormats).flatMap((formats) => Object.values(formats)),
  ),
  'application/octet-stream',
];

const extensionFormats: Record<string, MediaFormat> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  jfif: 'jpeg',
  pjpeg: 'jpeg',
  pjp: 'jpeg',
  png: 'png',
  apng: 'png',
  webp: 'webp',
  gif: 'gif',
  avif: 'avif',
  svg: 'svg',
  mp4: 'mp4',
  mov: 'mov',
  mkv: 'mkv',
};

export const MEDIA_EXTENSIONS = Object.keys(extensionFormats).map(
  (extension) => `.${extension}`,
);

export function mediaFormat(fileName: string): MediaFormat | null {
  const extension = /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase();
  return extension &&
    Object.prototype.hasOwnProperty.call(extensionFormats, extension)
    ? extensionFormats[extension]
    : null;
}

export function isVideoFormat(
  format: MediaFormat | null,
): format is VideoFormat {
  return format === 'mp4' || format === 'mov' || format === 'mkv';
}

export function mediaByteLimit(
  format: MediaFormat | null,
  config: ConfigService,
): number {
  return Math.min(
    config.getOrThrow<number>(
      format === null
        ? 'FILE_ASSET_SIZE'
        : isVideoFormat(format)
          ? 'VIDEO_ASSET_SIZE'
          : 'ASSETE_SIZE',
    ),
    config.getOrThrow<number>('STORAGE_MAX_FILE_BYTES'),
  );
}
