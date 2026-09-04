import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { AuditService } from './audit/audit.service';

@Module({
  imports: [AuthModule, UserModule, RoleModule, PermissionModule],
  providers: [AuditService],
})
export class IamModule {}
