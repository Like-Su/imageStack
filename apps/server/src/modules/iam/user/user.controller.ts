import { Controller, Get, Post } from '@nestjs/common';

@Controller('user')
export class UserController {
  @Post('me')
  async me() {}

  // 管理员增加用户
  @Post('create')
  async createUser() {}

  @Post('delete')
  async deleteUser() {}

  // 获取 用户角色
  @Get(':id/roles')
  async getUserRoles() {}
}
