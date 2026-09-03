import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReplaceRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissionCodes: string[];
}
