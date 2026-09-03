import { Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [RoleController],
  providers: [RoleService],
})
export class RoleModule {}
