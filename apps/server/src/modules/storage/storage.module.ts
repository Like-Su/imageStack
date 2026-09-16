import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LocalFsStorageProvider } from './local-fs-storage.provider';
import { RustFsStorageProvider } from './rustfs-storage.provider';
import { StorageProviderRegistry } from './storage-provider.registry';
import { StorageService } from './storage.service';
import type { StorageProvider } from './storage.provider';

const strategies = [LocalFsStorageProvider, RustFsStorageProvider];

@Module({
  imports: [ConfigModule],
  providers: [
    ...strategies,
    {
      provide: StorageProviderRegistry,
      useFactory: (...providers: StorageProvider[]) => {
        const registry = new StorageProviderRegistry();
        for (const provider of providers) registry.register(provider);
        return registry;
      },
      inject: strategies,
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
