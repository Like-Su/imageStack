import { Module } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [UserModule],
  providers: [LocalStrategy, JwtStrategy],
})
export class AuthModule {}
