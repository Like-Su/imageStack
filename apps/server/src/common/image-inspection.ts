import {
  HttpException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_FRAMES,
  IMAGE_MAX_PIXELS,
} from './media-formats';
import type { ImageFormat } from './media-formats';
import { sharp } from './sharp';
import { assertSafeSvg } from './svg-validation';

const mimeTypes: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

function detectImageFormat(bytes: Buffer): ImageFormat {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return 'jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
    return 'png';
  if (
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  if (['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)))
    return 'gif';
  if (bytes.length >= 16 && bytes.toString('ascii', 4, 8) === 'ftyp') {
    const boxSize = bytes.readUInt32BE(0);
    if (boxSize >= 16 && boxSize <= bytes.length) {
      const brands = [bytes.toString('ascii', 8, 12)];
      for (let offset = 16; offset + 4 <= boxSize; offset += 4)
        brands.push(bytes.toString('ascii', offset, offset + 4));
      if (brands.some((brand) => brand === 'avif' || brand === 'avis'))
        return 'avif';
    }
  }
  if (bytes.toString('utf8', 0, 1024).trimStart().startsWith('<')) return 'svg';
  throw new UnsupportedMediaTypeException(
    '图片内容不是受支持的 JPEG、PNG/APNG、WebP、GIF、AVIF 或 SVG',
  );
}

function pngFrames(bytes: Buffer): number | null {
  if (
    bytes.length < 33 ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString('ascii', 12, 16) !== 'IHDR'
  )
    throw new UnprocessableEntityException('PNG 缺少有效的图像头');
  const canvasWidth = bytes.readUInt32BE(16);
  const canvasHeight = bytes.readUInt32BE(20);
  let offset = 8;
  let frames: number | null = null;
  let frameCount = 0;
  let sequence = 0;
  let imageDataSeen = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const next = offset + length + 12;
    if (next > bytes.length) break;
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') imageDataSeen = true;
    if (type === 'acTL') {
      if (frames !== null || length !== 8 || imageDataSeen) break;
      frames = bytes.readUInt32BE(offset + 8);
      if (frames < 1 || frames > IMAGE_MAX_FRAMES)
        throw new UnprocessableEntityException(
          `动图最多支持 ${IMAGE_MAX_FRAMES} 帧`,
        );
    }
    if (type === 'fcTL') {
      if (
        frames === null ||
        length !== 26 ||
        ++frameCount > frames ||
        bytes.readUInt32BE(offset + 8) !== sequence++
      )
        break;
      const frameWidth = bytes.readUInt32BE(offset + 12);
      const frameHeight = bytes.readUInt32BE(offset + 16);
      if (
        !frameWidth ||
        !frameHeight ||
        bytes.readUInt32BE(offset + 20) + frameWidth > canvasWidth ||
        bytes.readUInt32BE(offset + 24) + frameHeight > canvasHeight ||
        bytes[offset + 32] > 2 ||
        bytes[offset + 33] > 1
      )
        break;
    }
    if (
      type === 'fdAT' &&
      (frames === null ||
        !frameCount ||
        length < 4 ||
        bytes.readUInt32BE(offset + 8) !== sequence++)
    )
      break;
    if (
      type === 'IEND' &&
      length === 0 &&
      (frames === null || frames === frameCount)
    )
      return frames;
    offset = next;
  }
  throw new UnprocessableEntityException('PNG/APNG 数据不完整');
}

export async function inspectImageContent(
  bytes: Buffer,
  expectedFormat?: ImageFormat,
) {
  if (!bytes.length || bytes.length > IMAGE_MAX_BYTES)
    throw new UnprocessableEntityException('图片不得超过 10 MiB');
  const format = detectImageFormat(bytes);
  if (expectedFormat && format !== expectedFormat)
    throw new UnsupportedMediaTypeException('图片扩展名与实际格式不一致');
  if (format === 'svg') assertSafeSvg(bytes);
  const animationFrames = format === 'png' ? pngFrames(bytes) : null;

  try {
    const decoder = sharp(bytes, {
      failOn: 'warning',
      limitInputPixels: IMAGE_MAX_PIXELS,
      page: 0,
      pages: 1,
    }).timeout({ seconds: 10 });
    const metadata = await decoder.metadata();
    const width = metadata.width;
    const height = metadata.pageHeight ?? metadata.height;
    const frames = animationFrames ?? metadata.pages ?? 1;
    if (
      metadata.format !== (format === 'avif' ? 'heif' : format) ||
      (format === 'avif' && metadata.compression !== 'av1') ||
      !width ||
      !height ||
      width * height > IMAGE_MAX_PIXELS ||
      frames < 1 ||
      frames > IMAGE_MAX_FRAMES
    )
      throw new UnprocessableEntityException(
        '图片格式、尺寸、帧数或像素数量不符合要求',
      );

    await decoder.clone().stats();
    const rotated =
      (metadata.orientation ?? 1) >= 5 && (metadata.orientation ?? 1) <= 8;
    return {
      decoder,
      metadata,
      mimeType: animationFrames === null ? mimeTypes[format] : 'image/apng',
      width: rotated ? height : width,
      height: rotated ? width : height,
    };
  } catch (error) {
    console.log(error);
    if (error instanceof HttpException) throw error;
    throw new UnprocessableEntityException('图片损坏、解码超时或超过解码限制');
  }
}
