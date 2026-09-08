import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  NotContains,
} from 'class-validator';
import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

export class ListAssetsDto extends CursorPaginationDto {
  @Transform(({ obj, key }) => {
    const value: unknown = obj[key];
    return value === 'true' ? true : value === 'false' ? false : value;
  })
  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @NotContains('\u0000')
  albumId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @NotContains('\u0000')
  tagId?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @NotContains('\u0000')
  tag?: string;
}

export class ThumbnailQueryDto {
  @IsOptional()
  @IsIn(['sm'])
  size: string = 'sm';
}
