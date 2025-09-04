import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { CAPTCHA_TYPE } from 'src/constants';
import { RedisService } from 'src/redis/redis.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserVo } from './vo/login-user.vo';
import { UpdateUserVo } from './vo/update-user.vo';
import { md5 } from 'src/utils';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { ForgetUserDto } from './dto/forget-user.dto';

@Injectable()
export class UserService {
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;
  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>;
  @InjectRepository(Permission)
  private readonly permissionRepository: Repository<Permission>;
  @Inject(RedisService)
  private readonly redisService: RedisService;

  private async createAdmin(user: RegisterUserDto) {
    const admin = new User();
    admin.nickname = user.username;
    admin.email = user.email;
    admin.password = md5(user.password);

    const role = await this.roleRepository.findOneBy({
      name: '管理员',
    });

    admin.roles = [role];
    await this.userRepository.save(admin);
  }

  private async createUser(user: RegisterUserDto) {
    const regularUser = new User();
    regularUser.nickname = user.username;
    regularUser.email = user.email;
    regularUser.password = md5(user.password);

    const role = await this.roleRepository.findOneBy({
      name: '阅览者',
    });

    regularUser.roles = [role];

    await this.userRepository.save(regularUser);
  }

  // 登录
  async login(loginUserDto: LoginUserDto) {
    // 查找用户
    const user = await this.userRepository.findOne({
      where: { email: loginUserDto.email },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.ACCEPTED);
    }
    if (user.password !== md5(loginUserDto.password)) {
      throw new HttpException('密码错误', HttpStatus.ACCEPTED);
    }

    const loginUserVo = new LoginUserVo();
    loginUserVo.userInfo = {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      picture: user.picture,
      status: user.status,
      createTime: user.createTime.getTime(),
      updateTime: user.updateTime.getTime(),
      roles: user.roles.map((role) => role.name),
      permissions: user.roles.reduce((prev, cur) => {
        cur.permissions.forEach((permission) =>
          !prev.includes(permission) ? prev.push(permission) : null,
        );
        return prev;
      }, []),
    };

    return loginUserVo;
  }

  // 注册
  async register(registerUserDto: RegisterUserDto) {
    // 验证 验证码
    await this.validationCaptcha(
      registerUserDto.email,
      registerUserDto.captcha,
      CAPTCHA_TYPE.REGISTER,
    );

    // 通过邮箱查找用户
    const foundUser = await this.userRepository.findOneBy({
      email: registerUserDto.email,
    });

    if (foundUser) {
      throw new HttpException('用户已存在', HttpStatus.BAD_REQUEST);
    }

    const isAdmin = await this.userRepository.exists();

    try {
      if (!isAdmin) {
        this.createAdmin(registerUserDto);
      } else {
        this.createUser(registerUserDto);
      }
      return 'success';
    } catch (e) {
      return e.message;
    }
  }

  // 忘记密码
  async forget(forgetUserDto: ForgetUserDto) {
    // 验证 验证码
    await this.validationCaptcha(
      forgetUserDto.email,
      forgetUserDto.captcha,
      CAPTCHA_TYPE.FORGET,
    );

    // 通过邮箱查找用户
    const foundUser = await this.userRepository.findOneBy({
      email: forgetUserDto.email,
    });

    if (!foundUser) {
      throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
    }

    // 更新密码
    foundUser.password = md5(forgetUserDto.password);

    try {
      return await this.userRepository.save(foundUser);
    } catch (e) {
      return e.message;
    }
  }

  async update(id: number, updateUserVo: UpdateUserDto) {
    const foundUser = await this.findUserById(id);

    if (updateUserVo.nickname) {
      foundUser.nickname = updateUserVo.nickname;
    }
    if (updateUserVo.picture) {
      foundUser.picture = updateUserVo.picture;
    }

    try {
      const user = await this.userRepository.save(foundUser);
      const vo = new UpdateUserVo();
      vo.id = user.id;
      vo.email = user.email;
      vo.status = user.status;
      vo.nickname = user.nickname;
      vo.picture = user.picture;
      vo.roles = user.roles.map((role) => role.name);
      vo.permissions = user.roles.reduce((prev, cur) => {
        cur.permissions.forEach((permission) =>
          !prev.includes(permission) ? prev.push(permission) : null,
        );
        return prev;
      }, []);
      vo.createTime = user.createTime;
      vo.updateTime = user.updateTime;

      return vo;
    } catch (e) {
      return e.message;
    }
  }

  // 通过 id 查找 user
  async findUserById(id: number) {
    return await this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async confirmUpload(id: number, confirmUploadDto: ConfirmUploadDto) {
    const user = await this.findUserById(id);
    user.picture = confirmUploadDto.fullName;
    await this.userRepository.save(user);
    return true;
  }

  // 效验验证码
  async validationCaptcha(email: string, captcha: string, type: CAPTCHA_TYPE) {
    const code = await this.redisService.get(`captcha_${email}_${type}`);
    if (!code) {
      throw new HttpException('验证码已失效', HttpStatus.ACCEPTED);
    }

    if (code !== captcha) {
      throw new HttpException('验错误错误', HttpStatus.ACCEPTED);
    }
    return true;
  }
}
