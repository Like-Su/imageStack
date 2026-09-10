import { createHash } from 'node:crypto';
import { VIDEO_MAX_DURATION_MS } from './media-formats';

export const HLS_SEGMENT_SECONDS = 4;
export const HLS_MAX_SEGMENTS =
  Math.ceil(VIDEO_MAX_DURATION_MS / 1000 / HLS_SEGMENT_SECONDS) + 2;
export const HLS_MAX_PLAYLIST_BYTES = 1024 * 1024;
export const HLS_PLAYLIST_NAME = 'index.m3u8';
export const HLS_SEGMENT_PATTERN = /^segment-([0-9]{6})\.ts$/;

export function hlsSegmentName(index: number) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= HLS_MAX_SEGMENTS)
    throw new RangeError('HLS 分段序号无效');
  return `segment-${String(index).padStart(6, '0')}.ts`;
}

export function hlsSegmentKey(playlistKey: string, index: number) {
  const identifier = createHash('sha256')
    .update(`hls:${playlistKey}:${hlsSegmentName(index)}`)
    .digest('hex')
    .slice(0, 32);
  return `derived/${identifier.slice(0, 2)}/${identifier}`;
}

export function hlsObjectKeys(
  playlistKey: string | null,
  segmentCount: number,
) {
  if (!playlistKey) return [];
  if (
    !Number.isSafeInteger(segmentCount) ||
    segmentCount < 0 ||
    segmentCount > HLS_MAX_SEGMENTS
  )
    throw new RangeError('HLS 分段数量无效');
  return [
    playlistKey,
    ...Array.from({ length: segmentCount }, (_, index) =>
      hlsSegmentKey(playlistKey, index),
    ),
  ];
}
