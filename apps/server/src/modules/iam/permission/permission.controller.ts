import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { RequireRole } from '../auth/decorators/roles-permissions.decorator';
import { RoleCode } from '../../../common/constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.type';
import {
  createPermissionSchema,
  updatePermissionSchema,
  type CreatePermissionInput,
  type UpdatePermissionInput,
} from './schemas/permission.schema';

@Controller('permission')
@RequireRole(RoleCode.ADMIN)
export class PermissionController {
  constructor(private readonly permissions: PermissionService) {}

  @Get()
  list() {
    return this.permissions.list();
  }

  @Post()
  create(
    @CurrentUser() actor: RequestUser,
    @Body({ schema: createPermissionSchema }) body: CreatePermissionInput,
  ) {
    return this.permissions.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: RequestUser,
    @Param('id') permissionId: string,
    @Body({ schema: updatePermissionSchema }) body: UpdatePermissionInput,
  ) {
    return this.permissions.update(actor, permissionId, body);
  }

  @Delete(':id')
  remove(@CurrentUser() actor: RequestUser, @Param('id') permissionId: string) {
    return this.permissions.remove(actor, permissionId);
  }
}
