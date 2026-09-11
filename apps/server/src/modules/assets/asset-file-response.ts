import {
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { StorageError } from '../storage/storage.provider';
import type {
  StorageProvider,
  StorageReadRange,
} from '../storage/storage.provider';

const streamLogger = new Logger('MediaStream');

function parseSingleRange(
  header: string | undefined,
  total: bigint,
): StorageReadRange | undefined {
  if (!header || header.includes(',')) {
    return undefined;
  }

  const matched = /^bytes=(\d*)-(\d*)$/.exec(header.trim());

  if (!matched || (!matched[1] && !matched[2])) {
    return undefined;
  }

  const startText = matched[1];
  const endText = matched[2];

  let start: bigint;
  let end: bigint;

  if (!startText) {
    const suffix = BigInt(endText);

    if (suffix === 0n || total === 0n) {
      throw new HttpException('请求的字节范围无效', 416);
    }

    start = suffix >= total ? 0n : total - suffix;
    end = total - 1n;
  } else {
    start = BigInt(startText);
    end = endText ? BigInt(endText) : total - 1n;

    if (start >= total || end < start) {
      throw new HttpException('请求的字节范围无效', 416);
    }

    if (end >= total) {
      end = total - 1n;
    }
  }

  return {
    start: Number(start),
    end: Number(end),
  };
}

export async function streamStoredMedia(
  storage: StorageProvider,
  resource: {
    key: string;
    mimeType: string;
    disposition?: string;
  },
  request: Request,
  response: Response,
): Promise<StreamableFile | undefined> {
  const metadata = await storage.stat(resource.key);

  if (!metadata) {
    throw new NotFoundException('存储对象不存在');
  }

  if (metadata.size <= 0n || metadata.size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InternalServerErrorException('存储对象大小不受支持');
  }

  const etag = `"${createHash('sha256').update(resource.key).digest('hex')}"`;

  response.setHeader('ETag', etag);
  response.setHeader('Cache-Control', 'private, no-cache');
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  if (resource.mimeType === 'image/svg+xml') {
    response.setHeader(
      'Content-Security-Policy',
      "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    );
  }
  response.vary('Authorization');

  if (request.fresh) {
    response.status(304);
    return;
  }

  let range: StorageReadRange | undefined;

  try {
    const ifRange = request.headers['if-range'];

    if (request.method === 'GET' && (!ifRange || ifRange === etag)) {
      range = parseSingleRange(request.headers.range, metadata.size);
    }
  } catch (error) {
    if (error instanceof HttpException && error.getStatus() === 416) {
      response.setHeader('Content-Range', `bytes */${metadata.size}`);
      response.removeHeader('ETag');
      response.setHeader('Cache-Control', 'no-store');
    }

    throw error;
  }

  if (request.method === 'HEAD') {
    response.setHeader('Content-Length', metadata.size.toString());
    response.setHeader('Content-Type', resource.mimeType);
    response.setHeader('Content-Disposition', resource.disposition ?? 'inline');
    response.status(200);
    return;
  }

  const opened = await storage
    .read(resource.key, range)
    .catch((error: unknown) => {
      if (error instanceof StorageError && error.code === 'NOT_FOUND') {
        throw new NotFoundException('存储对象不存在');
      }

      throw error;
    });

  if (opened.stat.size !== metadata.size) {
    opened.stream.destroy();
    throw new InternalServerErrorException('存储对象发生变化');
  }

  response.status(range ? 206 : 200);

  if (range) {
    response.setHeader(
      'Content-Range',
      `bytes ${range.start}-${range.end}/${metadata.size}`,
    );
  }

  const length = range ? range.end - range.start + 1 : Number(metadata.size);

  return new StreamableFile(opened.stream, {
    type: resource.mimeType,
    length,
    disposition: resource.disposition ?? 'inline',
  })
    .setErrorHandler(() => {
      response.destroy();
    })
    .setErrorLogger((error: Error & { code?: string }) => {
      if (error.code === 'ERR_STREAM_PREMATURE_CLOSE' && response.destroyed)
        return;
      streamLogger.error(
        `${request.method} ${request.path}: ${error.message}`,
        error.stack,
      );
    });
}
