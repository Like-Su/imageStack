import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailModule } from '../../../infrastructure/mail/mail.module';

// Custom Module
import { RoleGuard } from './guards/role.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { APP_GUARD } from '@nestjs/core';
import { EmailService } from './email.service';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PermissionGuard } from './guards/permission.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CsrfModule } from 'src/common/csrf/csrf.module';

@Module({
  imports: [
    CsrfModule,
    // 默认 策略为 jwt
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JWT 模块
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: config.getOrThrow<number>('JWT_ACCESS_TTL'),
          },
        };
      },
    }),
    MailModule,
    UserModule,
  ],
  providers: [
    AuthService,
    EmailService,
    JwtStrategy,
    // JwtAuthGuard -> RoleGuard -> PermissionGuard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
  controllers: [AuthController],
})
export class AuthModule {}
