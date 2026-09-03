import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { RoleService } from './role.service';
import { RequirePermission } from '../auth/decorators/roles-permissions.decorator';
import { PermissionCode } from 'src/common/constants';
import { ReplaceRolePermissionsDto } from './dto/replace-role-permissions.dto';

@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get(':id/permissions')
  @RequirePermission(PermissionCode.SYSTEM_ROLE)
  async getPermissions(@Param('id') roleId: string) {
    return this.roleService.getRolePermission(roleId);
  }

  @Patch(':id/permissions')
  @RequirePermission(PermissionCode.SYSTEM_ROLE_EDIT)
  async replacePermissions(
    @Param('id') roleId: string,
    @Body() dto: ReplaceRolePermissionsDto,
  ) {
    return this.roleService.replacePermissions(roleId, dto.permissionCodes);
  }
}
