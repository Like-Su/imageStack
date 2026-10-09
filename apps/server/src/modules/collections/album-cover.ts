import { BadRequestException } from '@nestjs/common';
import { sharp } from '../../common/sharp';

import { ALBUM_COVER_MAX_LENGTH } from './album-cover.constants';

export async function normalizeAlbumCover(value: string) {
  const invalid = () =>
    new BadRequestException('封面图片无效，请选择 PNG、JPEG 或 WebP 图片');
  if (value.length > ALBUM_COVER_MAX_LENGTH) throw invalid();
  const matched = value.match(
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!matched) throw invalid();

  try {
    const image = sharp(Buffer.from(matched[2], 'base64'), {
      limitInputPixels: 20_000_000,
      failOn: 'warning',
    }).timeout({ seconds: 5 });
    const metadata = await image.metadata();
    if (metadata.format !== matched[1] || (metadata.pages ?? 1) !== 1)
      throw invalid();

    for (const width of [640, 480, 320]) {
      const bytes = await image
        .clone()
        .rotate()
        .resize(width, (width * 3) / 4, {
          fit: 'cover',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();
      const cover = `data:image/webp;base64,${bytes.toString('base64')}`;
      if (cover.length <= ALBUM_COVER_MAX_LENGTH) return cover;
    }
    throw invalid();
  } catch {
    throw invalid();
  }
}
