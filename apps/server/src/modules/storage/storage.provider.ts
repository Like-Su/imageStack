import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { StorageProviderType } from '../../prisma/generated/prisma/enums';

export const StorageType = StorageProviderType;
export type StorageType = StorageProviderType;
export const storageProviderTypes = Object.values(StorageType);

export interface StorageLocation {
  storageProvider: StorageType | null;
  storageBucket: string | null;
}

export type StorageNamespace = 'originals' | 'derived' | 'uploads';

export function createStorageKey(
  namespace: StorageNamespace = 'originals',
): string {
  const identifier = randomUUID().replaceAll('-', '');

  return `${namespace}/${identifier.slice(0, 2)}/${identifier}`;
}

export interface StoredObject {
  key: string;
  size: bigint;
}

export interface StorageStat {
  size: bigint;
  modifiedAt: Date;
}

export interface StorageReadResult {
  stream: Readable;
  stat: StorageStat;
}

export interface StorageUsage {
  fileCount: number;
  totalBytes: bigint;
}

export interface StorageSpace {
  scope: 'filesystem' | 'bucket';
  usedBytes: bigint;
  totalBytes: bigint | null;
  availableBytes: bigint | null;
}

export interface StorageReadRange {
  start: number;
  end: number;
}

export interface StorageProvider {
  readonly type: StorageType;
  readonly bucket: string | null;
  put(key: string, input: Readable): Promise<StoredObject>;
  read(key: string, range?: StorageReadRange): Promise<StorageReadResult>;
  stat(key: string): Promise<StorageStat | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  space(): Promise<StorageSpace>;
}

export type StorageErrorCode =
  | 'INVALID_KEY'
  | 'UNSAFE_PATH'
  | 'INVALID_STREAM'
  | 'TOO_LARGE'
  | 'ALREADY_EXISTS'
  | 'INVALID_RANGE'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED_PROVIDER'
  | 'NOT_FOUND';

export class StorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
