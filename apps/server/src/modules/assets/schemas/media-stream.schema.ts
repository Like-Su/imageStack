import { z } from 'zod';

export const mediaStreamSchema = z.strictObject({
  kind: z.enum(['hls', 'original', 'download']),
});
export type MediaStreamInput = z.infer<typeof mediaStreamSchema>;
