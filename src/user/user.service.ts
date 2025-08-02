import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

  async initData() {
    const password = md5('123456');
    const user1 = new User();
    user1.nickname = 'test1';
    user1.email = '123@qq.com';
    user1.password = password;

    const user2 = new User();
    user2.nickname = 'test2';
    user2.email = '234@qq.com';
    user2.password = password;

    const role1 = new Role();
    role1.name = '管理员';

    const role2 = new Role();
    role2.name = '阅览者';

    const permission1 = new Permission();
    permission1.code = '1001';
    permission1.description = '上传';

    const permission2 = new Permission();
    permission2.code = '1002';
    permission2.description = '修改';

    const permission3 = new Permission();
    permission3.code = '1003';
    permission3.description = '浏览';

    const permission4 = new Permission();
    permission4.code = '1004';
    permission4.description = '删除';

    role1.permissions = [permission1, permission2, permission3, permission4];
    role2.permissions = [permission3];

    user1.roles = [role1];
    user2.roles = [role2];

    await this.permissionRepository.save([
      permission1,
      permission2,
      permission3,
      permission4,
    ]);

    await this.roleRepository.save([role1, role2]);

    await this.userRepository.save([user1, user2]);
  }

  // 登录
  async login(loginUserDto: LoginUserDto) {
    // 校验验证码
    await this.validationCaptcha(
      loginUserDto.email,
      loginUserDto.captcha,
      CAPTCHA_TYPE.LOGIN,
    );

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

    // 验证 两次输入密码是yizhi
    if (registerUserDto.password !== registerUserDto.enter_password) {
      throw new HttpException('密码输入不一致', HttpStatus.ACCEPTED);
    }

    // 通过邮箱查找用户
    const foundUser = await this.userRepository.findOneBy({
      email: registerUserDto.email,
    });

    if (foundUser) {
      throw new HttpException('用户已存在', HttpStatus.BAD_REQUEST);
    }

    // 创建用户
    const createUser = new User();
    createUser.email = registerUserDto.email;
    createUser.nickname = registerUserDto.email;
    createUser.password = md5(registerUserDto.password);

    try {
      await this.userRepository.save(createUser);
      return 'success';
    } catch (e) {
      return e.message;
    }
  }

  async update(id: number, updateUserVo: UpdateUserVo) {
    const foundUser = await this.findUserById(id);

    if (updateUserVo.nickname) {
      foundUser.nickname = updateUserVo.nickname;
    }
    if (updateUserVo.picture) {
      foundUser.picture = updateUserVo.picture;
    }
    if (updateUserVo.password) {
      foundUser.password = md5(updateUserVo.password);
    }

    try {
      return await this.userRepository.save(foundUser);
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
