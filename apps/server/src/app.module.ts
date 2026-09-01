import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

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
  providers: [AppService],
})
export class AppModule {}
