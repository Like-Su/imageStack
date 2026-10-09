import { Injectable } from '@nestjs/common';
import { StorageError } from './storage.provider';
import type { StorageProvider, StorageType } from './storage.provider';

@Injectable()
export class StorageProviderRegistry {
  private readonly providers = new Map<StorageType, StorageProvider>();

  register(provider: StorageProvider): void {
    if (this.providers.has(provider.type))
      throw new Error(`存储策略重复注册：${provider.type}`);
    this.providers.set(provider.type, provider);
  }

  get(type: StorageType): StorageProvider {
    const provider = this.providers.get(type);
    if (!provider)
      throw new StorageError('UNSUPPORTED_PROVIDER', `不支持存储类型：${type}`);
    return provider;
  }
}
