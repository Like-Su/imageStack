import { z } from 'zod';
import {
  optionalQuery,
  textSchema,
} from '../../../common/schemas/fields.schema';
import { listAssetsSchema } from '../../assets/schemas/assets-query.schema';

export const searchQuerySchema = listAssetsSchema.extend({
  q: optionalQuery(textSchema(0, 200)),
  mode: z
    .literal('keyword', {
      error: '当前支持 keyword 模式，可检索文件名、标签及 AI 识图结果',
    })
    .default('keyword'),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
