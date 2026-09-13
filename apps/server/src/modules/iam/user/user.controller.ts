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
  CreateUserDto,
  DeleteUserDto,
  ListUsersDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './dto/user.dto';
import { RequireRole } from '../auth/decorators/roles-permissions.decorator';
import { RoleCode } from '../../../common/constants';
import { PermissionCodesDto } from '../dto/iam.dto';

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
    @Body() body: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.id, user.sessionVersion, body);
  }

  @RequireRole(RoleCode.ADMIN)
  @Get(['', 'list-users'])
  listUsers(@Query() query: ListUsersDto) {
    return this.management.list(query);
  }

  @RequireRole(RoleCode.ADMIN)
  @Post(['', 'create'])
  createUser(@CurrentUser() actor: RequestUser, @Body() body: CreateUserDto) {
    return this.management.create(actor, body);
  }

  @RequireRole(RoleCode.ADMIN)
  @Patch(':id')
  updateUser(
    @CurrentUser() actor: RequestUser,
    @Param('id') userId: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.management.update(actor, userId, body);
  }

  @RequireRole(RoleCode.ADMIN)
  @Patch(':id/permissions')
  replacePermissions(
    @CurrentUser() actor: RequestUser,
    @Param('id') userId: string,
    @Body() body: PermissionCodesDto,
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
    @Body() body: DeleteUserDto,
  ) {
    return this.management.remove(actor, body.id);
  }
}
