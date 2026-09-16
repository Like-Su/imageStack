import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type CompletedPart,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { StorageError, StorageType } from './storage.provider';
import type {
  StoredObject,
  StorageProvider,
  StorageReadRange,
  StorageReadResult,
  StorageStat,
  StorageSpace,
} from './storage.provider';

const multipartBytes = 8 * 1024 * 1024;

@Injectable()
export class RustFsStorageProvider implements StorageProvider, OnModuleDestroy {
  readonly type = StorageType.RUSTFS;
  readonly bucket: string | null;
  private readonly client?: S3Client;
  private readonly maxFileBytes: bigint;
  private readonly logger = new Logger(RustFsStorageProvider.name);
  private readonly totalBytes: bigint | null;
  private spaceCache: { value: StorageSpace; expiresAt: number } | null = null;
  private spacePromise: Promise<StorageSpace> | null = null;
  private spaceRevision = 0;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('STORAGE_BUCKET') || null;
    const totalBytes = config.get<number>('STORAGE_TOTAL_BYTES');
    this.totalBytes = totalBytes ? BigInt(totalBytes) : null;
    this.maxFileBytes = BigInt(
      config.getOrThrow<number>('STORAGE_MAX_FILE_BYTES'),
    );
    if (this.maxFileBytes <= 0n)
      throw new Error('STORAGE_MAX_FILE_BYTES 必须大于 0');
    const endpoint = config.get<string>('STORAGE_ENDPOINT');
    const accessKeyId = config.get<string>('STORAGE_ACCESS_KEY');
    const secretAccessKey = config.get<string>('STORAGE_SECRET_KEY');
    if (!endpoint || !this.bucket || !accessKeyId || !secretAccessKey) return;
    this.client = new S3Client({
      endpoint,
      region: config.get<string>('STORAGE_REGION', 'us-east-1'),
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: config.get<boolean>('STORAGE_FORCE_PATH_STYLE', true),
      maxAttempts: 3,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      requestHandler: {
        connectionTimeout: 5000,
        socketTimeout: config.get<number>('STORAGE_REQUEST_TIMEOUT_MS', 60000),
      },
    });
  }

  onModuleDestroy() {
    this.client?.destroy();
  }

  async put(key: string, input: Readable): Promise<StoredObject> {
    const chunks = this.parts(input);
    let uploadId: string | undefined;
    let size = 0n;
    try {
      const target = this.target(key);
      const client = this.connection();
      const batch: Buffer[] = [];
      const fill = async () => {
        batch.length = 0;
        for (let index = 0; index < 2; index += 1) {
          const next = await chunks.next();
          if (next.done) break;
          batch.push(next.value);
          size += BigInt(next.value.byteLength);
        }
      };
      await fill();
      if (batch.length < 2) {
        const body = batch[0] ?? Buffer.alloc(0);
        await client.send(
          new PutObjectCommand({
            ...target,
            Body: body,
            ContentLength: body.byteLength,
            ContentType: 'application/octet-stream',
            IfNoneMatch: '*',
          }),
        );
        this.invalidateSpace();
        return { key, size };
      }
      const created = await client.send(
        new CreateMultipartUploadCommand({
          ...target,
          ContentType: 'application/octet-stream',
        }),
      );
      uploadId = created.UploadId;
      if (!uploadId)
        throw new StorageError('UNAVAILABLE', 'RustFS 未返回分段上传标识');
      const completed: CompletedPart[] = [];
      let partNumber = 0;
      while (batch.length) {
        if (partNumber + batch.length > 10000)
          throw new StorageError('TOO_LARGE', '文件超过对象存储分段数量限制');
        const results = await Promise.allSettled(
          batch.map(async (body) => {
            const number = ++partNumber;
            const uploaded = await client.send(
              new UploadPartCommand({
                ...target,
                UploadId: uploadId,
                PartNumber: number,
                Body: body,
                ContentLength: body.byteLength,
              }),
            );
            if (!uploaded.ETag)
              throw new StorageError('UNAVAILABLE', 'RustFS 未确认上传分段');
            return { PartNumber: number, ETag: uploaded.ETag };
          }),
        );
        for (const result of results) {
          if (result.status === 'rejected') throw result.reason;
          completed.push(result.value);
        }
        await fill();
      }
      await client.send(
        new CompleteMultipartUploadCommand({
          ...target,
          UploadId: uploadId,
          MultipartUpload: { Parts: completed },
          IfNoneMatch: '*',
        }),
      );
      uploadId = undefined;
      this.invalidateSpace();
      return { key, size };
    } catch (error) {
      if (uploadId && this.client) {
        await this.client
          .send(
            new AbortMultipartUploadCommand({
              Bucket: this.bucket!,
              Key: key,
              UploadId: uploadId,
            }),
          )
          .catch(() =>
            this.logger.warn(`RustFS 分段上传清理失败，需重试清理：${key}`),
          );
      }
      throw this.storageError(error);
    } finally {
      input.destroy();
      await chunks.return(undefined).catch(() => undefined);
    }
  }

  async read(
    key: string,
    range?: StorageReadRange,
  ): Promise<StorageReadResult> {
    let stream: Readable | undefined;
    try {
      if (
        range &&
        (!Number.isSafeInteger(range.start) ||
          !Number.isSafeInteger(range.end) ||
          range.start < 0 ||
          range.end < range.start)
      )
        throw new StorageError('INVALID_RANGE', '读取范围无效');
      const result = await this.connection().send(
        new GetObjectCommand({
          ...this.target(key),
          ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
        }),
      );
      if (!(result.Body instanceof Readable))
        throw new StorageError('UNAVAILABLE', 'RustFS 未返回可读取的数据流');
      stream = result.Body;
      let metadata = this.metadata(result.ContentLength, result.LastModified);
      if (range) {
        const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
          result.ContentRange ?? '',
        );
        if (
          !match ||
          result.$metadata.httpStatusCode !== 206 ||
          Number(match[1]) !== range.start ||
          Number(match[2]) !== range.end ||
          metadata.size !== BigInt(range.end - range.start + 1) ||
          BigInt(match[3]) <= BigInt(range.end)
        )
          throw new StorageError(
            'INVALID_RANGE',
            'RustFS 返回的范围与请求不一致',
          );
        metadata = { ...metadata, size: BigInt(match[3]) };
      }
      return { stream, stat: metadata };
    } catch (error) {
      stream?.destroy();
      throw this.storageError(error);
    }
  }

  async stat(key: string): Promise<StorageStat | null> {
    try {
      const result = await this.connection().send(
        new HeadObjectCommand(this.target(key)),
      );
      return this.metadata(result.ContentLength, result.LastModified);
    } catch (error) {
      const failure = this.storageError(error);
      if (failure.code === 'NOT_FOUND') return null;
      throw failure;
    }
  }

  async exists(key: string) {
    return (await this.stat(key)) !== null;
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.connection().send(new DeleteObjectCommand(this.target(key)));
      this.invalidateSpace();
      return true;
    } catch (error) {
      const failure = this.storageError(error);
      if (failure.code === 'NOT_FOUND') return false;
      throw failure;
    }
  }

  space(): Promise<StorageSpace> {
    if (this.spaceCache && this.spaceCache.expiresAt > Date.now())
      return Promise.resolve(this.spaceCache.value);
    if (this.spacePromise) return this.spacePromise;
    const revision = this.spaceRevision;
    const pending = this.readSpace()
      .then((value) => {
        if (revision === this.spaceRevision)
          this.spaceCache = { value, expiresAt: Date.now() + 30_000 };
        return value;
      })
      .finally(() => {
        if (this.spacePromise === pending) this.spacePromise = null;
      });
    this.spacePromise = pending;
    return pending;
  }

  private invalidateSpace() {
    this.spaceRevision += 1;
    this.spaceCache = null;
    this.spacePromise = null;
  }

  private async readSpace(): Promise<StorageSpace> {
    try {
      const client = this.connection();
      const signal = AbortSignal.timeout(15_000);
      let usedBytes = 0n;
      let continuationToken: string | undefined;
      const tokens = new Set<string>();
      do {
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket!,
            MaxKeys: 1000,
            ContinuationToken: continuationToken,
          }),
          { abortSignal: signal },
        );
        for (const object of result.Contents ?? []) {
          if (!Number.isSafeInteger(object.Size) || object.Size! < 0)
            throw new StorageError('UNAVAILABLE', '存储桶返回了无效的对象大小');
          usedBytes += BigInt(object.Size!);
        }
        continuationToken = result.IsTruncated
          ? result.NextContinuationToken
          : undefined;
        if (
          result.IsTruncated &&
          (!continuationToken || tokens.has(continuationToken))
        )
          throw new StorageError('UNAVAILABLE', '存储桶未返回有效的分页标识');
        if (continuationToken) tokens.add(continuationToken);
      } while (continuationToken);
      return {
        scope: 'bucket',
        usedBytes,
        totalBytes: this.totalBytes,
        availableBytes:
          this.totalBytes === null
            ? null
            : this.totalBytes > usedBytes
              ? this.totalBytes - usedBytes
              : 0n,
      };
    } catch (error) {
      throw this.storageError(error);
    }
  }

  private connection() {
    if (!this.client)
      throw new StorageError('UNAVAILABLE', 'RustFS 存储未配置完整');
    return this.client;
  }

  private target(key: string) {
    if (!/^(originals|derived|uploads)\/[0-9a-f]{2}\/[0-9a-f]{32}$/.test(key))
      throw new StorageError('INVALID_KEY', '非法 storage key');
    if (!this.bucket)
      throw new StorageError('UNAVAILABLE', 'RustFS 存储桶未配置');
    return { Bucket: this.bucket, Key: key };
  }

  private metadata(size?: number, modifiedAt?: Date): StorageStat {
    if (
      size === undefined ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      !modifiedAt ||
      !Number.isFinite(modifiedAt.getTime())
    )
      throw new StorageError('UNAVAILABLE', 'RustFS 返回了无效的文件元数据');
    return { size: BigInt(size), modifiedAt };
  }

  private storageError(error: unknown) {
    if (error instanceof StorageError) return error;
    const failure = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    } | null;
    const status = failure?.$metadata?.httpStatusCode;
    console.log(status);

    if (status === 404 && failure?.name !== 'NoSuchBucket')
      return new StorageError('NOT_FOUND', '存储对象不存在');
    if (status === 409 || status === 412)
      return new StorageError(
        'ALREADY_EXISTS',
        '目标文件已存在或写入冲突，不允许覆盖',
      );
    if (status === 416)
      return new StorageError('INVALID_RANGE', '读取范围无效');
    if (status === 413 || failure?.name === 'EntityTooLarge')
      return new StorageError('TOO_LARGE', '文件超过对象存储大小限制');
    return new StorageError(
      'UNAVAILABLE',
      'RustFS 请求失败，请检查服务连接、存储桶及访问权限',
    );
  }

  private async *parts(input: Readable): AsyncGenerator<Buffer> {
    let size = 0n;
    let buffered = 0;
    let buffers: Buffer[] = [];
    for await (const chunk of input) {
      if (!Buffer.isBuffer(chunk) && !(chunk instanceof Uint8Array))
        throw new StorageError(
          'INVALID_STREAM',
          '输入流必须输出 Buffer 或 Uint8Array',
        );
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += BigInt(bytes.byteLength);
      if (size > this.maxFileBytes)
        throw new StorageError('TOO_LARGE', '文件超过存储层大小限制');
      for (let offset = 0; offset < bytes.byteLength;) {
        const length = Math.min(
          multipartBytes - buffered,
          bytes.byteLength - offset,
        );
        buffers.push(bytes.subarray(offset, offset + length));
        buffered += length;
        offset += length;
        if (buffered === multipartBytes) {
          const part = Buffer.concat(buffers, buffered);
          buffers = [];
          buffered = 0;
          yield part;
        }
      }
    }
    if (buffered) yield Buffer.concat(buffers, buffered);
  }
}
