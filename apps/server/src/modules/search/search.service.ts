import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { AssetsService } from '../assets/assets.service';
import type { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  constructor(private readonly assets: AssetsService) {}

  async search(userId: string, query: SearchQueryDto) {
    const startedAt = performance.now();
    const keywords = [
      ...new Set((query.q ?? '').split(/\s+/u).filter(Boolean)),
    ].sort();

    if (keywords.length > 16) {
      throw new BadRequestException('最多支持 16 个不同关键词');
    }

    const scope = createHash('sha256')
      .update(
        JSON.stringify({
          resource: 'keyword-search',
          keywords,
          type: query.type,
          favorite: query.favorite,
          uncategorized: query.uncategorized,
          minSize: query.minSize,
          placeId: query.placeId,
          status: query.status,
          albumId: query.albumId,
          tagId: query.tagId,
          tag: query.tag,
          timeField: query.timeField ?? 'createdAt',
          year: query.year,
          from: query.from,
          to: query.to,
        }),
      )
      .digest('base64url');
    const page = await this.assets.search(userId, query, keywords, scope);
    const matchedBy = keywords.length > 0 ? ['keyword'] : ['filter'];

    return {
      mode: 'keyword' as const,
      items: page.items.map((asset) => ({ asset, score: null, matchedBy })),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      tookMs: Math.round(performance.now() - startedAt),
      parsed: null,
    };
  }
}
