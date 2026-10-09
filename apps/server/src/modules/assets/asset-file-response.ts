import {
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { StorageError } from '../../infrastructure/storage/storage.provider';
import type {
  StorageLocation,
  StorageReadRange,
  StorageStat,
} from '../../infrastructure/storage/storage.provider';
import type { StorageService } from '../../infrastructure/storage/storage.service';

const streamLogger = new Logger('MediaStream');

export function attachmentDisposition(fileName: string) {
  const encodedName = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="download"; filename*=UTF-8''${encodedName}`;
}

export function isMediaResponseClosed(request: Request, response: Response) {
  return request.aborted || response.destroyed || response.writableEnded;
}

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
  storage: StorageService,
  resource: StorageLocation & {
    key: string;
    mimeType: string;
    disposition?: string;
    stat?: StorageStat;
  },
  request: Request,
  response: Response,
): Promise<void> {
  if (isMediaResponseClosed(request, response)) return;
  const provider = storage.for(resource);
  const metadata = resource.stat ?? (await provider.stat(resource.key));
  if (isMediaResponseClosed(request, response)) return;

  if (!metadata) {
    throw new NotFoundException('存储对象不存在');
  }

  if (metadata.size <= 0n || metadata.size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InternalServerErrorException('存储对象大小不受支持');
  }

  const etag = `"${createHash('sha256')
    .update(
      JSON.stringify([
        resource.storageProvider,
        resource.storageBucket,
        resource.key,
      ]),
    )
    .digest('hex')}"`;

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
    response.status(304).end();
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
    response.status(200).end();
    return;
  }

  const opened = await provider
    .read(resource.key, range)
    .catch((error: unknown) => {
      if (error instanceof StorageError && error.code === 'NOT_FOUND') {
        throw new NotFoundException('存储对象不存在');
      }

      throw error;
    });

  if (isMediaResponseClosed(request, response)) {
    opened.stream.destroy();
    return;
  }

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

  response.setHeader('Content-Type', resource.mimeType);
  response.setHeader('Content-Length', length);
  response.setHeader('Content-Disposition', resource.disposition ?? 'inline');

  let clientDisconnected = false;
  const onResponseClose = () => {
    if (
      !response.writableFinished &&
      !opened.stream.errored &&
      !(opened.stream.destroyed && !opened.stream.readableEnded)
    )
      clientDisconnected = true;
  };
  response.once('close', onResponseClose);
  response.once('error', onResponseClose);

  try {
    await pipeline(opened.stream, response);
  } catch (error) {
    const failure = opened.stream.errored ?? error;
    const code =
      failure instanceof Error && 'code' in failure ? failure.code : undefined;
    if (
      clientDisconnected &&
      (code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        code === 'ERR_STREAM_UNABLE_TO_PIPE' ||
        code === 'ERR_STREAM_DESTROYED' ||
        code === 'ECONNRESET' ||
        code === 'EPIPE' ||
        code === 'ABORT_ERR')
    )
      return;
    streamLogger.error(
      `${request.method} ${request.path}: ${failure instanceof Error ? failure.message : String(failure)}`,
      failure instanceof Error ? failure.stack : undefined,
    );
  } finally {
    response.off('close', onResponseClose);
    response.off('error', onResponseClose);
    opened.stream.destroy();
    if (!response.destroyed && !response.writableEnded) response.destroy();
  }
}
