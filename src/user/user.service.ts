import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';

function md5(str) {
  const hash = crypto.createHash('md5');
  hash.update(str);
  return hash.digest('hex');
}

@Injectable()
export class UserService {
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;
  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>;
  @InjectRepository(Permission)
  private readonly permissionRepository: Repository<Permission>;

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

  async login(loginUserDto: LoginUserDto) {
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

    return user;
  }

  async findUserById(id: number) {
    return await this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions'],
    });
  }
}
