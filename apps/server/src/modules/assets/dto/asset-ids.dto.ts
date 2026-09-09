import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  NotContains,
} from 'class-validator';

export class AssetIdsDto {
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((id) => (typeof id === 'string' ? id.trim() : id))
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(128, { each: true })
  @NotContains('\u0000', { each: true })
  ids: string[];
}
