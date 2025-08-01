import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MINIO_CLIENT } from 'src/constants';
import { MinioService } from './minio.service';
import * as Minio from 'minio';

@Module({
  providers: [
    {
      provide: MINIO_CLIENT,
      async useFactory(configService: ConfigService) {
        const client = new Minio.Client({
          endPoint: configService.get('oss.uri'),
          port: configService.get('oss.port'),
          useSSL: configService.get('oss.useSSL'),
          accessKey: configService.get('oss.accessKey'),
          secretKey: configService.get('oss.secretKey'),
        });
        return client;
      },
      inject: [ConfigService]
    },
    MinioService
  ],
  exports: [MINIO_CLIENT, MinioService],
})
export class MinioModule { }
