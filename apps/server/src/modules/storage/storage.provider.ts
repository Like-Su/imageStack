import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export type StorageNamespace = 'originals' | 'derived';

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

export interface StorageProvider {
  put(key: string, input: Readable): Promise<StoredObject>;
  read(key: string): Promise<StorageReadResult>;
  stat(key: string): Promise<StorageStat | null>;
  exists(key: string): Promise<boolean>;
}

export type StorageErrorCode =
  | 'INVALID_KEY'
  | 'UNSAFE_PATH'
  | 'INVALID_STREAM'
  | 'TOO_LARGE'
  | 'ALREADY_EXISTS'
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
