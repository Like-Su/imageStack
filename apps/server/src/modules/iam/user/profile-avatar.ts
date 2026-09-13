import { BadRequestException } from '@nestjs/common';
import { sharp } from '../../../common/sharp';

export async function normalizeProfileAvatar(value: string) {
  const matched = value.match(
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!matched || value.length > 65536)
    throw new BadRequestException(
      '头像内容无效，请选择 PNG、JPEG 或 WebP 图片',
    );

  const input = Buffer.from(matched[2], 'base64');
  const signatures: Record<string, boolean> = {
    jpeg: input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff,
    png: input.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
    webp:
      input.toString('ascii', 0, 4) === 'RIFF' &&
      input.toString('ascii', 8, 12) === 'WEBP',
  };
  if (!signatures[matched[1]])
    throw new BadRequestException(
      '头像内容无效，请选择 PNG、JPEG 或 WebP 图片',
    );

  try {
    const image = sharp(input, {
      limitInputPixels: 20_000_000,
      failOn: 'warning',
    }).timeout({ seconds: 5 });
    const metadata = await image.metadata();
    if (metadata.format !== matched[1] || (metadata.pages ?? 1) !== 1)
      throw new Error('Invalid avatar format');
    const bytes = await image
      .rotate()
      .resize(256, 256, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const avatar = `data:image/webp;base64,${bytes.toString('base64')}`;
    if (avatar.length > 65536) throw new Error('Avatar too large');
    return avatar;
  } catch {
    throw new BadRequestException(
      '头像内容无效，请选择 PNG、JPEG 或 WebP 图片',
    );
  }
}
