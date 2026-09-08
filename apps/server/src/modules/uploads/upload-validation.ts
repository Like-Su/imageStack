import {
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
  RequestTimeoutException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_PIXELS,
  UPLOAD_READ_TIMEOUT_MS,
} from './upload.constants';
import { blake3 } from 'hash-wasm';
import { sharp } from '../../common/sharp';

// 图片上传类型
type ImageFormat = 'jpeg' | 'png' | 'webp';

const MIME_TYPES: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function detectFormat(bytes: Buffer): ImageFormat {
  // 格式判断
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'jpeg';
  }

  const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
  if (bytes.subarray(0, 8).equals(pngSignature)) {
    return 'png';
  }

  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  throw new UnsupportedMediaTypeException(
    `仅支持 ${Object.keys(MIME_TYPES).join(', ')}`,
  );
}

function assertStaticPng(bytes: Buffer) {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const chunkLength = bytes.readUInt32BE(offset);
    const nextOffset = offset + chunkLength + 12;

    if (nextOffset > bytes.length)
      throw new UnprocessableEntityException('PNG 数据不完整');

    const chunkType = bytes.toString('ascii', offset + 4, offset + 8);

    if (chunkType === 'acTl') {
      throw new UnsupportedMediaTypeException('暂不支持动画 PNG');
    }

    if (chunkType === 'IEND') return;

    offset = nextOffset;
  }

  throw new UnprocessableEntityException('PNG 缺少完整结束块');
}

export async function readUploadBody(
  request: Request,
  expectedBytes: number,
): Promise<Buffer> {
  if (request.destroyed || request.readableEnded) {
    throw new BadRequestException('连接已关闭或请求体已被读取');
  }

  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  const timeout = setTimeout(() => {
    request.destroy(new RequestTimeoutException('上传读取超时'));
  }, UPLOAD_READ_TIMEOUT_MS);
  try {
    for await (const chunk of request.iterator({
      destroyOnReturn: false,
    })) {
      if (!Buffer.isBuffer(chunk)) {
        throw new BadRequestException('上传内容必须是二进制');
      }

      receivedBytes += chunk.length;

      if (receivedBytes > UPLOAD_MAX_BYTES) {
        throw new PayloadTooLargeException('文件超过上传大小限制');
      }

      if (receivedBytes > expectedBytes) {
        throw new BadRequestException('实际大小超过会话声明大小');
      }

      chunks.push(chunk);
    }

    if (receivedBytes !== expectedBytes) {
      throw new BadRequestException('实际大小与会话声明大小不一致');
    }

    return Buffer.concat(chunks, receivedBytes);
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }

    throw new BadRequestException('上传连接中断或请求体读取失败');
  } finally {
    clearTimeout(timeout);
  }
}

export async function inspectImage(bytes: Buffer, expectedHash: string | null) {
  const format = detectFormat(bytes);

  if (format === 'png') {
    assertStaticPng(bytes);
  }

  const hash = await blake3(bytes);

  if (expectedHash && hash !== expectedHash) {
    throw new UnprocessableEntityException('文件 BLAKE3 校验失败');
  }

  try {
    const decoder = sharp(bytes, {
      failOn: 'warning',
      limitInputPixels: UPLOAD_MAX_PIXELS,
      animated: true,
    }).timeout({ seconds: 10 });

    const metadata = await decoder.metadata();

    if ((metadata.pages ?? 1) !== 1) {
      throw new UnsupportedMediaTypeException('暂不支持多帧图片');
    }

    if (
      metadata.format !== format ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > UPLOAD_MAX_PIXELS
    ) {
      throw new UnprocessableEntityException(
        '图片格式、尺寸或像素数量不符合要求',
      );
    }

    await decoder.stats();

    return {
      mimeType: MIME_TYPES[format],
      hash,
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }

    throw new UnprocessableEntityException('图片损坏、解码超时或超过解码限制');
  }
}
