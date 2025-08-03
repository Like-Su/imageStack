import { Inject, Injectable, Query } from '@nestjs/common';
import { MINIO_CLIENT } from 'src/constants';
import * as Minio from 'minio';

@Injectable()
export class MinioService {
  @Inject(MINIO_CLIENT)
  private readonly minioClient: Minio.Client;

  // 上传文件
  presignedPutObject(bucketName: string, fileName: string, expires = 24 * 60 * 60) {
    return this.minioClient.presignedPutObject(bucketName, fileName, expires);
  }

  // 列出所有文件
  presignedUrl(method: string, bucketName: string, fileName: string, expires: number = 60 * 60) {
    return this.minioClient.presignedUrl(method, bucketName, fileName, expires);
  }

  // 文件信息
  statObject(bucketName: string, fileName: string) {
    return this.minioClient.statObject(bucketName, fileName);
  }

  // 获取文件流
  getObject(bucketName: string, fileName: string) {
    return this.minioClient.getObject(bucketName, fileName);
  }
}
