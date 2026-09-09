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

  @IsIn(['keyword'], { message: 'M7 仅支持 keyword 搜索模式' })
  mode: 'keyword' = 'keyword';
}
