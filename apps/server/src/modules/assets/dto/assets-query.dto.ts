import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotContains,
} from 'class-validator';
import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';
import type { MediaProcessingStatus } from '../../../prisma/generated/prisma/client';

const dateFilterPattern =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/;

export class ListAssetsDto extends CursorPaginationDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsIn(['image', 'video', 'audio'])
  type?: 'image' | 'video' | 'audio';

  @IsOptional()
  @IsIn(['createdAt', 'takenAt'])
  timeField?: 'createdAt' | 'takenAt' = 'createdAt';

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  @Matches(dateFilterPattern)
  @IsISO8601({ strict: true, strictSeparator: true })
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  @Matches(dateFilterPattern)
  @IsISO8601({ strict: true, strictSeparator: true })
  to?: string;

  @IsOptional()
  @IsIn(['PENDING', 'PROCESSING', 'READY', 'FAILED'])
  status?: MediaProcessingStatus;

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
