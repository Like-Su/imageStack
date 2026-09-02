import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';

// Custom Module
import { RoleCode } from 'src/common/constants';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { User, UserStatus } from 'src/prisma/generated/prisma/client';

@Injectable()
export class UserService {
  private readonly slat = 10;
  constructor(private readonly prismaService: PrismaService) {}

  // 通过 email 查询用户
  async findByEmail(email: string) {
    return this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
  }
  // 通过 id 查询用户，不存在则抛出异常
  async findByIdOrThrow(id: string, msg: string = '用户不存在') {
    const user = await this.prismaService.user.findUnique({
      // 找未删除用户
      where: {
        id,
        deleted: false,
      },
    });

    if (!user) throw new NotFoundException(msg);

    return user;
  }

  // 注册
  async register(username: string, email: string, password: string) {
    const validEmail = await this.findByEmail(email);

    if (validEmail) throw new BadRequestException('邮箱已注册');

    // 加密
    const hashPassword = await hash(password, this.slat);
    // 创建
    const user = await this.prismaService.user.create({
      data: {
        username,
        email,
        password: hashPassword,
        role: {
          connect: {
            // 设置默认权限
            roleCode: RoleCode.USER,
          },
        },
      },
    });

    return this.registerVo(user);
  }

  registerVo(user: User) {
    const { id, username, email, status, createdAt, updatedAt } = user;

    return {
      id,
      username,
      email,
      status: status === UserStatus.ACTIVE ? '激活' : '未激活',
      createdAt,
      updatedAt,
    };
  }

  // 重置密码
  async resetPassword(userId: string, newPassword) {
    const user = await this.findByIdOrThrow(userId);
    await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        password: await hash(newPassword, this.slat),
      },
    });
    return true;
  }

  // 设置账户状态
  async setStatus(userId: string, status: UserStatus) {
    const user = await this.findByIdOrThrow(userId);
    this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        status,
      },
    });
    return true;
  }

  // 删除账户
  async deleteUser(userId: string) {
    const user = await this.findByIdOrThrow(userId);
    this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        deleted: true,
        status: UserStatus.DEACTIVE,
      },
    });
    return true;
  }

  // 获取用户列表
  async listAllUser(
    pageSize: number = 0,
    limit: number = 10,
    status: UserStatus = UserStatus.ACTIVE,
    deleted: boolean = false,
  ) {
    return await this.prismaService.user.findMany({
      where: {
        status,
        deleted,
      },
      // 选择返回 字段
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      },
      // 分页
      skip: pageSize * limit,
      take: limit,
      // 对 create 和 roleCode 排序

      orderBy: {
        createdAt: 'asc',
        role: {
          roleCode: 'asc',
        },
      },
    });
  }
}
