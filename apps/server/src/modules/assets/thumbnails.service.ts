import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { MediaAsset } from './asset-media';
import { MediaJobsService } from '../jobs/media-jobs.service';
import { THUMBNAIL_PROFILE } from '../jobs/media-processing.constants';
import { StorageService } from '../storage/storage.service';
import type { StorageLocation, StorageStat } from '../storage/storage.provider';

export type ThumbnailResponse =
  | (StorageLocation & {
      key: string;
      mimeType: 'image/webp' | 'video/mp4';
      stat: StorageStat;
    })
  | { assetId: string; status: 'PENDING' | 'PROCESSING' };

@Injectable()
export class ThumbnailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaJobs: MediaJobsService,
    private readonly storage: StorageService,
  ) {}

  async get(
    asset: MediaAsset,
    variant: 'thumbnail' | 'preview' = 'thumbnail',
  ): Promise<ThumbnailResponse> {
    const key = variant === 'preview' ? asset.previewKey : asset.thumbnailKey;
    const metadata = key ? await this.storage.for(asset).stat(key) : null;
    if (
      key &&
      metadata &&
      (variant === 'preview' ||
        asset.thumbnailVersion >= THUMBNAIL_PROFILE.version ||
        asset.processingStatus === 'FAILED')
    ) {
      return {
        storageProvider: asset.storageProvider,
        storageBucket: asset.storageBucket,
        key,
        mimeType: variant === 'preview' ? 'video/mp4' : 'image/webp',
        stat: metadata,
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
