import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from 'src/redis/redis.module';
import { JwtModule } from '@nestjs/jwt';
import { Permission } from 'src/user/entities/permission.entity';
import { Role } from 'src/user/entities/role.entity';
import { User } from 'src/user/entities/user.entity';
import { Picture } from 'src/picture/entities/picture.entity';
import { Tags } from 'src/picture/entities/tags.entity';
import { MinioModule } from 'src/minio/minio.module';
import { EmailModule } from 'src/email/email.module';

@Global()
@Module({
  imports: [
    RedisModule,
    TypeOrmModule.forRootAsync({
      useFactory(configService: ConfigService) {
        return {
          type: 'mysql',
          host: configService.get('db.mysql.host'),
          port: configService.get('db.mysql.port'),
          username: configService.get('db.mysql.username'),
          password: configService.get('db.mysql.password'),
          database: configService.get('db.mysql.database'),
          synchronize: configService.get('db.mysql.synchronize'),
          logging: configService.get('db.mysql.logging'),
          // entities: ['../**/entity/*.entity.ts'],
          entities: [User, Role, Permission, Picture, Tags],
          poolSize: configService.get('db.mysql.poolSize'),
          connectorPackage: 'mysql2',
          extra: {
            // authPlugin: 'sha256_password',
          },
        };
      },
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      useFactory(configService: ConfigService) {
        return {
          secret: configService.get('jwt.secret'),
          signOptions: {
            expiresIn: configService.get('jwt.expiresIn'),
          },
        };
      },
      inject: [ConfigService],
    }),
    MinioModule,
    EmailModule
  ],
  exports: [RedisModule, JwtModule, MinioModule, EmailModule],
})
export class SharedModule { }
