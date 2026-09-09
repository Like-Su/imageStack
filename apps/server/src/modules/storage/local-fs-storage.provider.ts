import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import {
  FileHandle,
  lstat,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { StorageError } from './storage.provider';
import type {
  StoredObject,
  StorageProvider,
  StorageReadRange,
  StorageReadResult,
  StorageStat,
  StorageUsage,
} from './storage.provider';

@Injectable()
export class LocalFsStorageProvider implements StorageProvider, OnModuleInit {
  private readonly root: string;
  private readonly maxFileBytes: bigint;

  constructor(private readonly configService: ConfigService) {
    const configuredRoot =
      this.configService.getOrThrow<string>('STORAGE_ROOT');

    this.root = resolve(configuredRoot);

    // STORAGE_ROOT 必须是绝对路径
    if (!this.root || !this.isAbsolutePath(this.root)) {
      throw new Error('STORAGE_ROOT 必须是绝对路径');
    }

    // 禁止直接使用文件系统根目录
    if (this.root === resolve(this.root, '..')) {
      throw new Error('STORAGE_ROOT 不能是文件系统根目录');
    }

    this.maxFileBytes = BigInt(
      this.configService.getOrThrow<number>('STORAGE_MAX_FILE_BYTES'),
    );

    if (this.maxFileBytes <= 0n) {
      throw new Error('STORAGE_MAX_FILE_BYTES 必须大于 0');
    }
  }

  /**
   * 初始化存储目录
   */
  async onModuleInit(): Promise<void> {
    await mkdir(this.root, {
      recursive: true,
    });

    await this.assertDirectory(this.root);

    await this.directory(['.tmp'], true);

    await this.directory(['originals'], true);

    await this.directory(['derived'], true);
  }

  /**
   * 写入文件
   */
  async put(key: string, input: Readable): Promise<StoredObject> {
    const target = this.resolveKey(key);

    // 创建目标目录
    await this.directory(target.parts.slice(0, -1), true);

    const temporaryPath = join(this.root, '.tmp', `${randomUUID()}.part`);

    let size = 0n;

    try {
      /**
       * 先写临时文件，写完之后再移动到目标位置。
       */
      const output = createWriteStream(temporaryPath, {
        flags: 'wx',
        mode: 0o600,
      });

      input.on('data', (chunk: Buffer | Uint8Array) => {
        if (!Buffer.isBuffer(chunk) && !(chunk instanceof Uint8Array)) {
          input.destroy(
            new StorageError(
              'INVALID_STREAM',
              '输入流必须输出 Buffer 或 Uint8Array',
            ),
          );

          return;
        }

        size += BigInt(chunk.byteLength);

        if (size > this.maxFileBytes) {
          input.destroy(
            new StorageError('TOO_LARGE', '文件超过存储层大小限制'),
          );
        }
      });

      await pipeline(input, output);

      /**
       * 不允许覆盖已有文件。
       */
      try {
        await lstat(target.absolutePath);

        throw new StorageError('ALREADY_EXISTS', '目标文件已存在，不允许覆盖');
      } catch (error) {
        if (error instanceof StorageError) {
          throw error;
        }

        if (!this.hasCode(error, 'ENOENT')) {
          throw error;
        }
      }

      /**
       * Windows / Linux 都可以使用 rename。
       *
       * 注意：
       * 当前版本依然依赖文件系统 rename 的基本原子性。
       * 更严格的原子创建语义后续再增强。
       */
      await rename(temporaryPath, target.absolutePath);

      return {
        key,
        size,
      };
    } catch (error) {
      input.destroy();
      throw error;
    } finally {
      await rm(temporaryPath, {
        force: true,
      });
    }
  }

  /**
   * 读取文件
   */
  async read(
    key: string,
    range?: StorageReadRange,
  ): Promise<StorageReadResult> {
    const target = this.resolveKey(key);
    let handle: FileHandle | undefined;

    try {
      await this.directory(target.parts.slice(0, -1), false);
      await this.assertFile(target.absolutePath);

      handle = await open(target.absolutePath, 'r');

      const metadata = await handle.stat();

      if (!metadata.isFile()) {
        throw new StorageError('NOT_FOUND', '文件不存在');
      }

      if (
        range &&
        (!Number.isSafeInteger(range.start) ||
          !Number.isSafeInteger(range.end) ||
          range.start < 0 ||
          range.end < range.start ||
          range.end >= metadata.size)
      ) {
        throw new StorageError('INVALID_RANGE', '读取范围无效');
      }

      const stream = handle.createReadStream({
        autoClose: true,
        start: range?.start,
        end: range?.end,
      });

      handle = undefined;

      return {
        stream,
        stat: {
          size: BigInt(metadata.size),
          modifiedAt: metadata.mtime,
        },
      };
    } catch (error) {
      await handle?.close();

      if (this.hasCode(error, 'ENOENT')) {
        throw new StorageError('NOT_FOUND', '文件不存在');
      }

      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async stat(key: string): Promise<StorageStat | null> {
    const target = this.resolveKey(key);

    try {
      const metadata = await lstat(target.absolutePath);

      // 不允许 symlink
      if (metadata.isSymbolicLink()) {
        throw new StorageError('UNSAFE_PATH', '不允许通过符号链接访问文件');
      }

      // 必须是普通文件
      if (!metadata.isFile()) {
        return null;
      }

      return {
        size: BigInt(metadata.size),
        modifiedAt: metadata.mtime,
      };
    } catch (error) {
      if (this.hasCode(error, 'ENOENT')) {
        return null;
      }

      throw error;
    }
  }

  /**
   * 判断文件是否存在
   */
  async exists(key: string): Promise<boolean> {
    return (await this.stat(key)) !== null;
  }

  /**
   * 删除文件
   */
  async delete(key: string): Promise<boolean> {
    const target = this.resolveKey(key);

    try {
      const metadata = await lstat(target.absolutePath);

      if (metadata.isSymbolicLink()) {
        throw new StorageError('UNSAFE_PATH', '不允许删除符号链接');
      }

      if (!metadata.isFile()) {
        return false;
      }

      await rm(target.absolutePath);

      return true;
    } catch (error) {
      if (this.hasCode(error, 'ENOENT')) {
        return false;
      }

      throw error;
    }
  }

  /**
   * 统计存储空间
   */
  async usage(): Promise<StorageUsage> {
    const result: StorageUsage = {
      fileCount: 0,
      totalBytes: 0n,
    };

    for (const namespace of ['originals', 'derived']) {
      const namespacePath = join(this.root, namespace);

      let buckets: string[];

      try {
        buckets = await readdir(namespacePath);
      } catch (error) {
        if (this.hasCode(error, 'ENOENT')) {
          continue;
        }

        throw error;
      }

      for (const bucket of buckets) {
        // bucket 必须是两位十六进制
        if (!/^[0-9a-f]{2}$/.test(bucket)) {
          throw new StorageError('UNSAFE_PATH', `非法 bucket：${bucket}`);
        }

        const bucketPath = join(namespacePath, bucket);

        const entries = await readdir(bucketPath, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          // 只允许普通文件
          if (!entry.isFile()) {
            throw new StorageError('UNSAFE_PATH', '存储对象必须是普通文件');
          }

          const filePath = join(bucketPath, entry.name);

          const metadata = await stat(filePath);

          result.fileCount += 1;
          result.totalBytes += BigInt(metadata.size);
        }
      }
    }

    return result;
  }

  /**
   * storage key → 文件系统路径
   *
   * 这是 LocalFsStorageProvider 的核心安全边界。
   */
  private resolveKey(key: string): {
    absolutePath: string;
    parts: string[];
  } {
    const matched = /^(originals|derived)\/([0-9a-f]{2})\/([0-9a-f]{32})$/.exec(
      key,
    );

    if (!matched) {
      throw new StorageError('INVALID_KEY', '非法 storage key');
    }

    const absolutePath = resolve(this.root, key);

    /**
     * 防止路径逃逸 root。
     */
    const relativePath = relative(this.root, absolutePath);

    if (
      relativePath === '' ||
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`)
    ) {
      throw new StorageError('INVALID_KEY', 'storage key 不能越过存储根目录');
    }

    return {
      absolutePath,
      parts: key.split('/'),
    };
  }

  /**
   * 确保目录安全。
   */
  private async assertDirectory(directoryPath: string): Promise<void> {
    const metadata = await lstat(directoryPath);

    if (metadata.isSymbolicLink()) {
      throw new StorageError('UNSAFE_PATH', '存储目录不能是符号链接');
    }

    if (!metadata.isDirectory()) {
      throw new StorageError('UNSAFE_PATH', '存储路径必须是目录');
    }
  }

  /**
   * 创建 / 获取目录。
   */
  private async directory(parts: string[], create: boolean): Promise<string> {
    let currentPath = this.root;

    await this.assertDirectory(currentPath);

    for (const part of parts) {
      const nextPath = join(currentPath, part);

      if (create) {
        await mkdir(nextPath, {
          recursive: true,
          mode: 0o700,
        });
      }

      await this.assertDirectory(nextPath);

      currentPath = nextPath;
    }

    return currentPath;
  }

  /**
   * 确保目标是普通文件。
   */
  private async assertFile(filePath: string): Promise<void> {
    const metadata = await lstat(filePath);

    if (metadata.isSymbolicLink()) {
      throw new StorageError('UNSAFE_PATH', '不允许通过符号链接访问文件');
    }

    if (!metadata.isFile()) {
      throw new StorageError('UNSAFE_PATH', '存储对象必须是普通文件');
    }
  }

  private isAbsolutePath(path: string): boolean {
    return resolve(path) === path;
  }

  private hasCode(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
  }
}
