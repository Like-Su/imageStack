import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [AssetsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
