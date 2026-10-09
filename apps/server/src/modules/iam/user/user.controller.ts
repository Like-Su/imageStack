import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.type';
import { UserService } from './user.service';
import { UserManagementService } from './user-management.service';
import {
  createUserSchema,
  deleteUserSchema,
  listUsersSchema,
  updateProfileSchema,
  updateUserSchema,
  type CreateUserInput,
  type DeleteUserInput,
  type ListUsersQuery,
  type UpdateProfileInput,
  type UpdateUserInput,
} from './schemas/user.schema';
import { RequireRole } from '../auth/decorators/roles-permissions.decorator';
import { RoleCode } from '../../../common/constants';
import {
  permissionCodesSchema,
  type PermissionCodesInput,
} from '../schemas/iam.schema';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly management: UserManagementService,
  ) {}

  @Post('me')
  me(@CurrentUser() user: RequestUser) {
    return this.userService.getProfile(user.id, user.sessionVersion);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body({ schema: updateProfileSchema }) body: UpdateProfileInput,
  ) {
    return this.userService.updateProfile(user.id, user.sessionVersion, body);
  }

  @RequireRole(RoleCode.ADMIN)
  @Get(['', 'list-users'])
  listUsers(@Query({ schema: listUsersSchema }) query: ListUsersQuery) {
    return this.management.list(query);
  }

  @RequireRole(RoleCode.ADMIN)
  @Post(['', 'create'])
  createUser(
    @CurrentUser() actor: RequestUser,
    @Body({ schema: createUserSchema }) body: CreateUserInput,
  ) {
    return this.management.create(actor, body);
  }

  @RequireRole(RoleCode.ADMIN)
  @Patch(':id')
  updateUser(
    @CurrentUser() actor: RequestUser,
    @Param('id') userId: string,
    @Body({ schema: updateUserSchema }) body: UpdateUserInput,
  ) {
    return this.management.update(actor, userId, body);
  }

  @RequireRole(RoleCode.ADMIN)
  @Patch(':id/permissions')
  replacePermissions(
    @CurrentUser() actor: RequestUser,
    @Param('id') userId: string,
    @Body({ schema: permissionCodesSchema }) body: PermissionCodesInput,
  ) {
    return this.management.update(actor, userId, body);
  }

  @RequireRole(RoleCode.ADMIN)
  @Delete(':id')
  deleteUser(@CurrentUser() actor: RequestUser, @Param('id') userId: string) {
    return this.management.remove(actor, userId);
  }

  @RequireRole(RoleCode.ADMIN)
  @Post('delete')
  deleteUserLegacy(
    @CurrentUser() actor: RequestUser,
    @Body({ schema: deleteUserSchema }) body: DeleteUserInput,
  ) {
    return this.management.remove(actor, body.id);
  }
}
