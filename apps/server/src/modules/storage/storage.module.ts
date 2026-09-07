import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { STORAGE_PROVIDER } from './storage.provider';
import { LocalFsStorageProvider } from './local-fs-storage.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    LocalFsStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: LocalFsStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
