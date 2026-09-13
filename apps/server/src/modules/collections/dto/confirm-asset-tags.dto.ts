import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  NotContains,
} from 'class-validator';

export class ConfirmAssetTagsDto {
  @IsIn(['existing', 'create'])
  mode: 'existing' | 'create';

  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((name) => (typeof name === 'string' ? name.trim() : name))
      : value,
  )
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  @NotContains('\u0000', { each: true })
  names: string[] = [];

  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((id) => (typeof id === 'string' ? id.trim() : id))
      : value,
  )
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(128, { each: true })
  @NotContains('\u0000', { each: true })
  tagIds: string[] = [];
}
