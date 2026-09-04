import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
// Custom Module
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/auth.type';
import { UserService } from './user.service';
import { CreateUserDto, DeleteUserDto } from './dto/user.dto';
import { RequireRole } from '../auth/decorators/roles-permissions.decorator';
import { RoleCode } from 'src/common/constants';
import { UserStatus } from 'src/prisma/generated/prisma/enums';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Post('me')
  async me(@CurrentUser() user: RequestUser) {
    return this.userService.getAuthUser(user.id);
  }

  // 管理员增加用户
  @RequireRole(RoleCode.ADMIN)
  @Post('create')
  createUser(@Body() dto: CreateUserDto) {
    return this.userService.register(
      dto.username,
      dto.email,
      dto.password,
      dto.status,
    );
  }

  // 删除用户
  @RequireRole(RoleCode.ADMIN)
  @Post('delete')
  deleteUser(@Body() dto: DeleteUserDto) {
    return this.userService.deleteUser(dto.id);
  }

  @RequireRole(RoleCode.ADMIN)
  @Get('list-users')
  listUsers(
    @Query('page-size') pageSize,
    @Query('limit') limit,
    @Query('status') status = UserStatus.ACTIVE,
  ) {
    return this.userService.listAllUser(pageSize, limit, status);
  }
}
