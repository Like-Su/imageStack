import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserManagementService } from './user-management.service';

@Module({
  providers: [UserService, UserManagementService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
