import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common';
import { ElasticsearchService } from './elasticsearch.service';
import { ELASTICSEARCH_MODULE_OPTIONS } from './elasticsearch.constants';

interface ElasticsearchModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: any;
  useClass?: any;
  useFactory?: any;
  inject?: any[];
}

@Module({})
export class ElasticsearchModule {
  static register(): DynamicModule {
    return {
      module: ElasticsearchModule,
      providers: [ElasticsearchService],
      exports: [ElasticsearchService],
    };
  }

  static registerAsync(
    options: ElasticsearchModuleAsyncOptions,
  ): DynamicModule {
    return {
      imports: options.imports || [],
      module: ElasticsearchModule,
      providers: [
        ElasticsearchService,
        {
          provide: ELASTICSEARCH_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [ElasticsearchService],
    };
  }
}
