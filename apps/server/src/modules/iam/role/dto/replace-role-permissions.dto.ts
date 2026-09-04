import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  MinLength,
  IsOptional,
} from 'class-validator';

// 编辑角色权限
export class ReplaceRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissionCodes: string[];
}

// 创建角色
export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  roleName: string;

  @IsString()
  @MinLength(1)
  roleCode: string;

  @IsOptional()
  @IsString()
  description?: string;
}
