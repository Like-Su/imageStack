import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { RequireRole } from '../auth/decorators/roles-permissions.decorator';
import { RoleCode } from '../../../common/constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.type';
import {
  replaceRolePermissionsSchema,
  type ReplaceRolePermissionsInput,
} from './schemas/replace-role-permissions.schema';
import {
  createRoleSchema,
  updateRoleSchema,
  type CreateRoleInput,
  type UpdateRoleInput,
} from './schemas/role.schema';

@Controller('role')
@RequireRole(RoleCode.ADMIN)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  list() {
    return this.roleService.list();
  }

  @Post()
  create(
    @CurrentUser() actor: RequestUser,
    @Body({ schema: createRoleSchema }) body: CreateRoleInput,
  ) {
    return this.roleService.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: RequestUser,
    @Param('id') roleId: string,
    @Body({ schema: updateRoleSchema }) body: UpdateRoleInput,
  ) {
    return this.roleService.update(actor, roleId, body);
  }

  @Delete(':id')
  remove(@CurrentUser() actor: RequestUser, @Param('id') roleId: string) {
    return this.roleService.remove(actor, roleId);
  }

  @Get(':id/permissions')
  getPermissions(@Param('id') roleId: string) {
    return this.roleService.getRolePermission(roleId);
  }

  @Patch(':id/permissions')
  replacePermissions(
    @CurrentUser() actor: RequestUser,
    @Param('id') roleId: string,
    @Body({ schema: replaceRolePermissionsSchema })
    body: ReplaceRolePermissionsInput,
  ) {
    return this.roleService.update(actor, roleId, body);
  }
}
