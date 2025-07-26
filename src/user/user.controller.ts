import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Inject,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RedisService } from 'src/redis/redis.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { NeedPermissions, UnNeedLogin } from 'src/interface.guard.decorator';
import { PERMISSIONS } from 'src/constants';

@Controller('user')
export class UserController {
  @Inject(RedisService)
  private readonly redisService: RedisService;
  @Inject(JwtService)
  private readonly jwtService: JwtService;

  constructor(private readonly userService: UserService) {}

  @Get('init')
  async initData() {
    await this.userService.initData();
    return 'done';
  }

  @Get('test')
  @NeedPermissions(PERMISSIONS.UPLOAD)
  async test() {
    return 'done';
  }

  @Post('login')
  @UnNeedLogin()
  async login(@Body() loginUserDto: LoginUserDto) {
    console.log(loginUserDto);
    const user = await this.userService.login(loginUserDto);

    const token = this.jwtService.sign({
      user: {
        userId: user.id,
        nickname: user.nickname,
        email: user.email,
        roles: user.roles,
        permissions: user.roles[0].permissions,
      },
    });

    return token;
  }
}
