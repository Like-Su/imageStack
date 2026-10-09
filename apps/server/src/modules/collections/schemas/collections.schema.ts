import { z } from 'zod';
import { textSchema } from '../../../common/schemas/fields.schema';
import { assetIdsSchema } from '../../assets/schemas/asset-ids.schema';
import { ALBUM_COVER_MAX_LENGTH } from '../album-cover.constants';

const albumNameSchema = textSchema(1, 200);
const albumDescriptionSchema = textSchema(0, 2000).nullish();
const coverImageSchema = z
  .string()
  .trim()
  .max(ALBUM_COVER_MAX_LENGTH)
  .nullish();

export const createAlbumSchema = z.strictObject({
  shared: z.boolean().optional(),
  name: albumNameSchema,
  description: albumDescriptionSchema,
  coverImage: coverImageSchema,
});
export const updateAlbumSchema = createAlbumSchema
  .omit({ shared: true })
  .partial()
  .extend({
    coverAssetId: textSchema(1, 128).nullish(),
  });

export const createTagSchema = z.strictObject({ name: textSchema(1, 100) });
export const updateTagSchema = createTagSchema.partial().extend({
  mergeIntoId: textSchema(1, 128).optional(),
});
export const addAssetTagsSchema = z.strictObject({
  names: z.array(textSchema(1, 100)).min(1).max(50),
});
export const batchAssetTagsSchema = addAssetTagsSchema.extend(
  assetIdsSchema.shape,
);

export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;
export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type AddAssetTagsInput = z.infer<typeof addAssetTagsSchema>;
export type BatchAssetTagsInput = z.infer<typeof batchAssetTagsSchema>;
