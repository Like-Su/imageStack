import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class ShareTargetDto {
  @IsIn(['asset', 'album'])
  kind: 'asset' | 'album';

  @IsString()
  @Length(1, 100)
  targetId: string;
}

export class CreateShareDto extends ShareTargetDto {
  @Type(() => Number)
  @IsIn([0, 1, 7, 30])
  expiresInDays: number = 7;
}

export class ShareTokenDto {
  @Matches(/^[A-Za-z0-9_-]{22}$/)
  token: string;
}

export class ShareAssetDto extends ShareTokenDto {
  @IsString()
  @Length(1, 100)
  assetId: string;
}

export class SharePageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 24;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  cursor?: string;
}
