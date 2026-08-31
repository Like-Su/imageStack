import { Module } from '@nestjs/common';
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

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
