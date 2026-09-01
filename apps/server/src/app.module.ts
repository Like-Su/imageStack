import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// Custom Module
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IamModule } from './modules/iam/iam.module';
import { AssetsModule } from './modules/assets/assets.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { SearchModule } from './modules/search/search.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { StorageModule } from './modules/storage/storage.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { AiModule } from './modules/ai/ai.module';
import { LibrariesModule } from './modules/libraries/libraries.module';
import { PluginsModule } from './modules/plugins/plugins.module';
import { SystemModule } from './modules/system/system.module';
import { CommonModule } from './common/common.module';
import { envSchema } from './schema';
import { redisConfig } from './common/redis/redis.config';

@Module({
  imports: [
    // 配置
    ConfigModule.forRoot({
      isGlobal: true,
      // 匹配 环境 文件列表
      envFilePath: ['.env', '.env.local'],
      // 缓存配置，避免重复解析
      cache: true,
      load: [redisConfig],
      // 校验环境变量
      validate: (config) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          console.error(
            '❌ Invalid environment variables:',
            result.error.format(),
          );
          process.exit(1);
        }
        return result.data;
      },
    }),
    // 限流
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 100,
        },
      ],
    }),
    // Custom Module
    IamModule,
    AssetsModule,
    UploadsModule,
    SearchModule,
    JobsModule,
    StorageModule,
    CollectionsModule,
    AiModule,
    LibrariesModule,
    PluginsModule,
    SystemModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // TODO: 截流问题
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard
    // }
  ],
})
export class AppModule {}
