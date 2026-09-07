import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  IsInt,
  Matches,
  Max,
} from 'class-validator';
import { UPLOAD_MAX_BYTES } from '../upload.constants';

export class CreateUploadSessionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[^/\\\u0000-\u001f\u007f]+$/u, {
    message: 'fileName 不能包含路径分隔符或控制字符',
  })
  fileName: string;

  @IsInt()
  @Min(1)
  @Max(UPLOAD_MAX_BYTES)
  size: number;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{64}$/, {
    message: 'hash 必须是 64 位小写十六进制 BLAKE3',
  })
  hash?: string;
}
