import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { SharedModule } from './shared/shared.module';
import { RedisModule } from './redis/redis.module';

// config
import config from './config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BuildResponseInterceptor } from './build-response.interceptor';
import { LoginGuard } from './login.guard';
import { PermissionGuard } from './permission.guard';
import { AuthModule } from './auth/auth.module';
import { PictureModule } from './picture/picture.module';
import { SystemModule } from './system/system.module';
import { MinioModule } from './minio/minio.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    UserModule,
    SharedModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
    }),
    AuthModule,
    PictureModule,
    SystemModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 构造 响应返回对象
    {
      provide: APP_INTERCEPTOR,
      useClass: BuildResponseInterceptor,
    },
    // 登录 守卫
    {
      provide: APP_GUARD,
      useClass: LoginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule { }
