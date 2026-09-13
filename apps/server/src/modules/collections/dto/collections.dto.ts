import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  NotContains,
  ValidateIf,
} from 'class-validator';

function trimInput({ obj, key }: TransformFnParams): unknown {
  const value: unknown = obj[key];
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateAlbumDto {
  @Transform(trimInput)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @NotContains('\u0000')
  name: string;

  @Transform(trimInput)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @NotContains('\u0000')
  description?: string | null;
}

export class UpdateAlbumDto {
  @Transform(trimInput)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @NotContains('\u0000')
  name?: string;

  @Transform(trimInput)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @NotContains('\u0000')
  description?: string | null;

  @Transform(trimInput)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @NotContains('\u0000')
  coverAssetId?: string | null;
}

export class CreateTagDto {
  @Transform(trimInput)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @NotContains('\u0000')
  name: string;
}

export class UpdateTagDto {
  @Transform(trimInput)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @NotContains('\u0000')
  name?: string;

  @Transform(trimInput)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @NotContains('\u0000')
  mergeIntoId?: string;
}

export class AddAssetTagsDto {
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((name) => (typeof name === 'string' ? name.trim() : name))
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  @NotContains('\u0000', { each: true })
  names: string[];
}

export class BatchAssetTagsDto extends AddAssetTagsDto {
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
