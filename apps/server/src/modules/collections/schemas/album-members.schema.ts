import { z } from 'zod';

export const albumMemberPermissionsSchema = z.strictObject({
  canAdd: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canRemove: z.boolean().default(false),
});
export const inviteAlbumMemberSchema = albumMemberPermissionsSchema.extend({
  email: z.string().trim().toLowerCase().max(320).check(z.email()),
});

export type AlbumMemberPermissionsInput = z.infer<
  typeof albumMemberPermissionsSchema
>;
export type InviteAlbumMemberInput = z.infer<typeof inviteAlbumMemberSchema>;
