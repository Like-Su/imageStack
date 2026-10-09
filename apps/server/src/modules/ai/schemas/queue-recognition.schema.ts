import { z } from 'zod';
import { assetIdsSchema } from '../../assets/schemas/asset-ids.schema';

export const queueRecognitionSchema = assetIdsSchema.partial();
export type QueueRecognitionInput = z.infer<typeof queueRecognitionSchema>;
