export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_PIXELS = 20_000_000;
export const IMAGE_MAX_FRAMES = 1000;
export const VIDEO_MAX_BYTES = 512 * 1024 * 1024;
export const VIDEO_MAX_DURATION_MS = 4 * 60 * 60 * 1000;

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

export function isVideoFormat(format: MediaFormat): format is VideoFormat {
  return format === 'mp4' || format === 'mov' || format === 'mkv';
}

export function mediaByteLimit(format: MediaFormat): number {
  return isVideoFormat(format) ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
}
