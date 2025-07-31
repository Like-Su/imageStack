import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable } from '@nestjs/common';
import { LoginUserDto } from 'src/user/dto/login-user.dto';
import { UserService } from 'src/user/user.service';
import { Request } from 'express';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  @Inject(UserService)
  private readonly userService: UserService;
  constructor() {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, email: string, password: string) {
    const loginUserDto = new LoginUserDto();
    loginUserDto.email = email;
    loginUserDto.password = password;
    loginUserDto.captcha = req.body.captcha;

    return await this.userService.login(loginUserDto);
  }
}
