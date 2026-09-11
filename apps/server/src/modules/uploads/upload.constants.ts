// 上传最大字节数
export { VIDEO_MAX_BYTES as UPLOAD_MAX_BYTES } from '../../common/media-formats';
// 上传最大像素数
export { IMAGE_MAX_PIXELS as UPLOAD_MAX_PIXELS } from '../../common/media-formats';
// 上传会话过期时间
export const UPLOAD_SESSION_TTL_MS = 30 * 60 * 1000;
// 上传读取超时时间
export const UPLOAD_READ_TIMEOUT_MS = 2 * 60 * 1000;
export const UPLOAD_VIDEO_READ_TIMEOUT_MS = 10 * 60 * 1000;
// 上传最大并发数
export const UPLOAD_MAX_CONCURRENT = 2;

export const UPLOAD_CHUNK_BYTES = 5 * 1024 * 1024;
export const UPLOAD_MULTIPART_TTL_MS = 24 * 60 * 60 * 1000;
export const UPLOAD_PART_MAX_CONCURRENT = 6;
export const UPLOAD_MERGE_LEASE_MS = 2 * 60 * 1000;
export const UPLOAD_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
