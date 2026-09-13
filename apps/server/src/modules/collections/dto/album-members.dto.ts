import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, MaxLength } from 'class-validator';

export class AlbumMemberPermissionsDto {
  @IsBoolean()
  canAdd: boolean = false;

  @IsBoolean()
  canEdit: boolean = false;

  @IsBoolean()
  canRemove: boolean = false;
}

export class InviteAlbumMemberDto extends AlbumMemberPermissionsDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email: string;
}
