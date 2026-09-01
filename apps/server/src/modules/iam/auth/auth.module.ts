import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailerModule, MailerOptions } from '@nestjs-modules/mailer';

// Custom Module
import { RoleGuard } from './guards/role.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { APP_GUARD } from '@nestjs/core';
import { EmailService } from './email.service';

@Module({
  imports: [
    // 默认 策略为 jwt
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JWT 模块
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          secret: config.get<string>('JWT_SECRET', 'image-stack'),
        };
      },
    }),
    // Email 配置
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          transport: {
            host: config.get<string>('MAIL_HOST'),
            port: config.get<string>('MAIL_PORT'),
            secure: config.get<string>('MAIL_SECURE'),
            auth: {
              user: config.get<string>('MAIL_USER'),
              pass: config.get<string>('MAIL_PASS'),
            },
          },
          defaults: {
            from: config.get<string>('MAIL_SEND_FROM'),
          },
        } as MailerOptions;
      },
    }),
  ],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
    EmailService,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
