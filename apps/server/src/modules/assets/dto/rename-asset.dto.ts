import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RenameAssetDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[^/\\\u0000-\u001f\u007f]+$/u, {
    message: '文件名称不能包含路径分隔符或控制字符',
  })
  name: string;
}
