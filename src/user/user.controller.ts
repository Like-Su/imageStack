import {
  Controller,
  Get,
  Post,
  Body,
  Inject,
  Query,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  UploadedFile,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { RedisService } from 'src/redis/redis.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { NeedPermissions, UnNeedLogin } from 'src/interface.guard.decorator';
import { CAPTCHA_TYPE, PERMISSIONS } from 'src/constants';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserInfo } from 'src/user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { LoginUserVo } from './vo/login-user.vo';
import { RefreshToken } from './vo/refresh-token.vo';
import { UpdateUserVo } from './vo/update-user.vo';
import { PermissionGuard } from 'src/permission.guard';

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

  // 发送验证码
  @Get('captcha')
  @UnNeedLogin()
  async captcha(@Query('email') email: string, type: CAPTCHA_TYPE) {
    const captchaCode = Math.random().toString().slice(2, 8);
    // 保存到 redis
    await this.redisService.set(
      `captcha_${email}_${type}`,
      captchaCode,
      3 * 60,
    );

    // 只有注册和忘记密码需要验证码到邮箱
    if (type === CAPTCHA_TYPE.REGISTER || type === CAPTCHA_TYPE.FORGET) {
      // send email
      // this.emailService.
      return 'success';
    }

    return captchaCode;
  }

  // @UseInterceptors(ClassSerializerInterceptor)
  @UseGuards(AuthGuard('local'))
  @UnNeedLogin()
  @Post('login')
  async login(@UserInfo() loginUserVo: LoginUserVo) {
    const userInfo = loginUserVo.userInfo;
    // 创建 accessToken
    const accessToken = this.jwtService.sign(
      {
        user: {
          userId: userInfo.id,
          nickname: userInfo.nickname,
          email: userInfo.email,
          roles: userInfo.roles,
          permissions: userInfo.permissions,
        },
      },
      { expiresIn: this.configService.get('jwt.access_token') || '30m' },
    );

    const refreshToken = this.jwtService.sign(
      {
        user: {
          userId: userInfo.id,
        },
      },
      { expiresIn: this.configService.get('jwt.refresh_token') || '7d' },
    );

    loginUserVo.access_token = accessToken;
    loginUserVo.refresh_token = refreshToken;

    return loginUserVo;
  }

  // 注册
  @Post('register')
  @UnNeedLogin()
  async register(@Body() registerUser: RegisterUserDto) {
    return await this.userService.register(registerUser);
  }

  // 刷新 token
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

      const refreshTokenInstance = new RefreshToken();
      refreshTokenInstance.access_token = accessToken;
      refreshTokenInstance.refresh_token = newRefreshToken;

      return refreshTokenInstance;
    } catch (e) {
      throw new UnauthorizedException('token 失效, 请重新登陆');
    }
  }

  @Post('update_user_info')
  async updateUserInfo(
    @UserInfo('id') userId,
    @Body() updateUserVo: UpdateUserVo,
  ) {
    return await this.userService.update(userId, updateUserVo);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: 'uploads',
      limits: {
        fileSize: 1024 * 1024 * 10,
      },
    }),
  )
  uploadHeadPicture(@UploadedFile() file: Express.Multer.File) {
    console.log('file', file);
    return file.path;
  }
}
