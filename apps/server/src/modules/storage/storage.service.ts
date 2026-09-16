import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProviderRegistry } from './storage-provider.registry';
import { StorageError, StorageType } from './storage.provider';
import type { StorageLocation, StorageProvider } from './storage.provider';

@Injectable()
export class StorageService {
  constructor(
    private readonly registry: StorageProviderRegistry,
    private readonly config: ConfigService,
  ) {}

  get defaultLocation(): StorageLocation & { storageProvider: StorageType } {
    const provider = this.registry.get(
      this.config.get<StorageType>('STORAGE_DRIVER', StorageType.LOCAL_FS),
    );
    return { storageProvider: provider.type, storageBucket: provider.bucket };
  }

  async space() {
    try {
      const provider = this.for(this.defaultLocation);
      const result = await provider.space();

      return {
        provider: provider.type,
        scope: result.scope,
        usedBytes: result.usedBytes.toString(),
        totalBytes: result.totalBytes?.toString() ?? null,
        availableBytes: result.availableBytes?.toString() ?? null,
      };
    } catch {
      throw new ServiceUnavailableException('暂时无法获取存储空间，请稍后重试');
    }
  }

  for(location: StorageLocation): StorageProvider {
    if (!location.storageProvider)
      throw new StorageError('UNSUPPORTED_PROVIDER', '文件未记录存储类型');
    const provider = this.registry.get(location.storageProvider);
    if (provider.bucket !== location.storageBucket)
      throw new StorageError(
        'UNAVAILABLE',
        '文件所属存储桶与当前配置不一致，请恢复原存储配置或先迁移文件',
      );
    return provider;
  }
}
