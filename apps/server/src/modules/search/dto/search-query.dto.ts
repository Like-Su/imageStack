import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  NotContains,
} from 'class-validator';
import { ListAssetsDto } from '../../assets/dto/assets-query.dto';

export class SearchQueryDto extends ListAssetsDto {
  @Transform(({ obj, key }) => {
    const value: unknown = obj[key];
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @NotContains('\u0000')
  q?: string;

  @IsIn(['keyword'], {
    message: '当前支持 keyword 模式，可检索文件名、标签及 AI 识图结果',
  })
  mode: 'keyword' = 'keyword';
}
