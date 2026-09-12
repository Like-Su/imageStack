import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { FileNode } from '../../prisma/generated/prisma/client';
import { MediaJobsService } from '../jobs/media-jobs.service';
import { THUMBNAIL_PROFILE } from '../jobs/media-processing.constants';
import { STORAGE_PROVIDER } from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';

export type ThumbnailResponse =
  | { key: string; mimeType: 'image/webp' | 'video/mp4' }
  | { assetId: string; status: 'PENDING' | 'PROCESSING' };

@Injectable()
export class ThumbnailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaJobs: MediaJobsService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  async get(
    asset: FileNode,
    variant: 'thumbnail' | 'preview' = 'thumbnail',
  ): Promise<ThumbnailResponse> {
    const key = variant === 'preview' ? asset.previewKey : asset.thumbnailKey;
    if (
      key &&
      (await this.storage.exists(key)) &&
      (variant === 'preview' ||
        asset.thumbnailVersion >= THUMBNAIL_PROFILE.version ||
        asset.processingStatus === 'FAILED')
    ) {
      return {
        key,
        mimeType: variant === 'preview' ? 'video/mp4' : 'image/webp',
      };
    }

    if (asset.processingStatus === 'FAILED') {
      throw new UnprocessableEntityException({
        code: 'ASSET_PROCESSING_FAILED',
        message: asset.processingError ?? '媒体处理失败',
        details: { assetId: asset.id, status: 'FAILED' },
      });
    }

    if (asset.processingStatus === 'READY') {
      const updated = await this.prisma.fileNode.updateMany({
        where: {
          id: asset.id,
          ownerId: asset.ownerId,
          storageKey: asset.storageKey,
          thumbnailKey: asset.thumbnailKey,
          thumbnailVersion: asset.thumbnailVersion,
          previewKey: asset.previewKey,
          processingStatus: 'READY',
        },
        data: {
          processingStatus: 'PENDING',
          processingError: null,
          processingAttempts: 0,
          processingToken: null,
          processingLeaseUntil: null,
          processingNextAttemptAt: null,
        },
      });

      if (updated.count !== 1) {
        return { assetId: asset.id, status: 'PENDING' };
      }
    }

    await this.mediaJobs.enqueue(asset.id, asset.ownerId);

    return {
      assetId: asset.id,
      status:
        asset.processingStatus === 'PROCESSING' ? 'PROCESSING' : 'PENDING',
    };
  }
}
