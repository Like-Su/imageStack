import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Inject,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RedisService } from 'src/redis/redis.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { NeedPermissions, UnNeedLogin } from 'src/interface.guard.decorator';
import { PERMISSIONS } from 'src/constants';
import { ConfigService } from '@nestjs/config';

@Controller('user')
export class UserController {
  @Inject(ConfigService)
  private readonly configService: ConfigService;
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
    const user = await this.userService.login(loginUserDto);

    // 创建 accessToken
    const accessToken = this.jwtService.sign(
      {
        user: {
          userId: user.id,
          nickname: user.nickname,
          email: user.email,
          roles: user.roles,
          permissions: user.roles[0].permissions,
        },
      },
      { expiresIn: this.configService.get('jwt.access_token') },
    );

    const refreshToken = this.jwtService.sign(
      {
        user: {
          userId: user.id,
        },
      },
      { expiresIn: this.configService.get('jwt.refresh_token') },
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  @Get('refresh')
  @UnNeedLogin()
  async refresh(@Query('refresh_token') refreshToken: string) {
    try {
      const refreshTokenData = this.jwtService.verify(refreshToken);
      const user = await this.userService.findUserById(
        refreshTokenData.user.userId,
      );

      const accessToken = this.jwtService.sign(
        {
          user: {
            userId: user.id,
            nickname: user.nickname,
            email: user.email,
            roles: user.roles,
            permissions: user.roles[0].permissions,
          },
        },
        { expiresIn: this.configService.get('jwt.access_token') || '30m' },
      );

      const newRefreshToken = this.jwtService.sign(
        {
          user: {
            userId: user.id,
          },
        },
        { expiresIn: this.configService.get('jwt.refresh_token') || '7d' },
      );

      return {
        access_token: accessToken,
        refresh_token: newRefreshToken,
      };
    } catch (e) {
      throw new UnauthorizedException('token 失效, 请重新登陆');
    }
  }
}
