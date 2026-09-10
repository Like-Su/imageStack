import {
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
  RequestTimeoutException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request } from 'express';
import { blake3, createBLAKE3 } from 'hash-wasm';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { inspectImageContent } from '../../common/image-inspection';
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from '../../common/media-formats';
import type { ImageFormat } from '../../common/media-formats';
import {
  UPLOAD_READ_TIMEOUT_MS,
  UPLOAD_VIDEO_READ_TIMEOUT_MS,
} from './upload.constants';

async function* uploadChunks(
  request: Readable,
  expectedBytes: number,
  maxBytes: number,
  timeoutMs: number,
): AsyncGenerator<Buffer> {
  if (request.destroyed || request.readableEnded)
    throw new BadRequestException('连接已关闭或请求体已被读取');
  let receivedBytes = 0;
  const timeout = setTimeout(() => {
    request.destroy(new RequestTimeoutException('上传读取超时'));
  }, timeoutMs);
  try {
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      if (!Buffer.isBuffer(chunk))
        throw new BadRequestException('上传内容必须是二进制');
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes)
        throw new PayloadTooLargeException('文件超过上传大小限制');
      if (receivedBytes > expectedBytes)
        throw new BadRequestException('实际大小超过会话声明大小');
      yield chunk;
    }
    if (receivedBytes !== expectedBytes)
      throw new BadRequestException('实际大小与会话声明大小不一致');
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new BadRequestException('上传连接中断或请求体读取失败');
  } finally {
    clearTimeout(timeout);
  }
}

export async function readUploadBody(
  request: Readable,
  expectedBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of uploadChunks(
    request,
    expectedBytes,
    IMAGE_MAX_BYTES,
    UPLOAD_READ_TIMEOUT_MS,
  ))
    chunks.push(chunk);
  return Buffer.concat(chunks, expectedBytes);
}

export async function stageVideoUpload(
  request: Readable,
  expectedBytes: number,
  expectedHash: string | null,
) {
  const directory = await mkdtemp(join(tmpdir(), 'image-stack-upload-'));
  const path = join(directory, 'source');
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    const hasher = await createBLAKE3();
    hasher.init();
    async function* content() {
      for await (const chunk of uploadChunks(
        request,
        expectedBytes,
        VIDEO_MAX_BYTES,
        UPLOAD_VIDEO_READ_TIMEOUT_MS,
      )) {
        hasher.update(chunk);
        yield chunk;
      }
    }
    await pipeline(
      Readable.from(content()),
      createWriteStream(path, { flags: 'wx', mode: 0o600 }),
    );
    const hash = hasher.digest('hex');
    if (expectedHash && hash !== expectedHash)
      throw new UnprocessableEntityException('文件 BLAKE3 校验失败');
    return { path, hash, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export async function inspectImage(
  bytes: Buffer,
  expectedHash: string | null,
  format?: ImageFormat,
) {
  const hash = await blake3(bytes);
  if (expectedHash && hash !== expectedHash)
    throw new UnprocessableEntityException('文件 BLAKE3 校验失败');
  const image = await inspectImageContent(bytes, format);
  return {
    mediaType: 'IMAGE' as const,
    mimeType: image.mimeType,
    hash,
    width: image.width,
    height: image.height,
    durationMs: null as number | null,
  };
}

export function assertUploadHeaders(request: Request, expectedBytes: number) {
  const contentType = request.headers['content-type']
    ?.split(';')[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/octet-stream')
    throw new UnsupportedMediaTypeException(
      '请使用 application/octet-stream 上传原始二进制',
    );
  const encoding = request.headers['content-encoding'];
  if (encoding && encoding.toLowerCase() !== 'identity')
    throw new UnsupportedMediaTypeException('不接受压缩的上传请求');
  const contentLength = request.headers['content-length'];
  if (
    contentLength !== undefined &&
    (!/^[0-9]+$/.test(contentLength) || Number(contentLength) !== expectedBytes)
  )
    throw new BadRequestException('Content-Length 与声明大小不一致');
}
