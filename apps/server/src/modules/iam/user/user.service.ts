import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';

// Custom Module
import { User as AuthUser, UserProfile } from '../auth/auth.type';
import { RedisKey, RoleCode } from 'src/common/constants';
import { PASSWORD_RESET_INVALID_MESSAGE } from 'src/common/constants/auth';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { withSerializable } from 'src/common/prisma/transaction';
import { RedisService } from 'src/common/redis/redis.service';
import { User, UserStatus } from 'src/prisma/generated/prisma/client';
import { UpdateProfileDto } from './dto/user.dto';
import { normalizeProfileAvatar } from './profile-avatar';

const AUTH_USER_TTL = 30 * 60;
@Injectable()
export class UserService {
  private readonly slat = 10;
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

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

  // 获取已激活用户信息
  private async loadAuthUser(userId: string, sessionVersion: number) {
    const user = await this.prismaService.user.findUnique({
      // 被删除 未激活用户查不到表示 无权限
      where: {
        id: userId,
        deleted: false,
        status: UserStatus.ACTIVE,
        sessionVersion,
      },
      select: {
        id: true,
        username: true,
        email: true,
        permissions: {
          select: { permission: { select: { permissionCode: true } } },
        },
        role: {
          select: {
            roleCode: true,
            status: true,
            roleName: true,
            permissions: {
              select: { permission: { select: { permissionCode: true } } },
            },
          },
        },
      },
    });

    // 角色被禁用也无权限
    if (!user || user.role.status !== 1) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.role.roleName,
      roleCode: user.role.roleCode,
      permissions: [
        ...new Set(
          [...user.role.permissions, ...user.permissions].map(
            (entry) => entry.permission.permissionCode,
          ),
        ),
      ],
    };
  }

  // 每个带 Token 请求都会经过这里, 先调用 Redis miss 在查库
  async getAuthUser(
    userId: string,
    expectedVersion?: number,
  ): Promise<AuthUser> {
    const sessionVersion =
      expectedVersion ?? (await this.getSessionVersion(userId));
    if (sessionVersion === null) return null;
    const key = `${RedisKey.authUser(userId)}:v${sessionVersion}`;
    const cached = await this.redisService.get(key);
    if (cached) {
      const user = JSON.parse(cached) as AuthUser & { avatar?: unknown };
      if ('avatar' in user) {
        delete user.avatar;
        await this.redisService.set(key, JSON.stringify(user), AUTH_USER_TTL);
      }
      return user;
    }

    const user = await this.loadAuthUser(userId, sessionVersion);
    if (user) {
      await this.redisService.set(key, JSON.stringify(user), AUTH_USER_TTL);
    }
    return user;
  }

  async getProfile(
    userId: string,
    sessionVersion: number,
  ): Promise<UserProfile> {
    const user = await this.getAuthUser(userId, sessionVersion);
    if (!user) return null;
    const profile = await this.prismaService.user.findUnique({
      where: {
        id: userId,
        deleted: false,
        status: UserStatus.ACTIVE,
        role: { status: 1 },
        sessionVersion,
      },
      select: { username: true, avatar: true },
    });
    return profile ? { ...user, ...profile } : null;
  }

  async updateProfile(
    userId: string,
    sessionVersion: number,
    body: UpdateProfileDto,
  ) {
    const avatar =
      body.avatar == null
        ? body.avatar
        : await normalizeProfileAvatar(body.avatar);
    const where = {
      id: userId,
      deleted: false,
      status: UserStatus.ACTIVE,
      role: { status: 1 },
      sessionVersion,
    };
    await withSerializable(this.prismaService, async (transaction) => {
      const before = await transaction.user.findUnique({
        where,
        select: { username: true, avatar: true },
      });
      if (!before)
        throw new UnauthorizedException('账户状态已变化，请重新登录');
      const result = await transaction.user.updateMany({
        where,
        data: { username: body.username, avatar },
      });
      if (result.count !== 1)
        throw new UnauthorizedException('账户状态已变化，请重新登录');
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'user.profile.update',
          entityType: 'User',
          entityId: userId,
          beforeJson: { usernameChanged: false, avatarChanged: false },
          afterJson: {
            usernameChanged: before.username !== body.username,
            avatarChanged: avatar !== undefined && before.avatar !== avatar,
          },
        },
      });
    });
    await this.evictAuthUser(userId);
    const profile = await this.getProfile(userId, sessionVersion);
    if (!profile) throw new UnauthorizedException('账户状态已变化，请重新登录');
    return profile;
  }

  // 用户变化后 调用(改状态, 删除, 改角色, 重置密码等)
  async evictAuthUser(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { sessionVersion: true },
    });
    await this.redisService.del(
      RedisKey.authUser(userId),
      `${RedisKey.authUser(userId)}:v${user?.sessionVersion ?? 0}`,
    );
  }

  // 注册
  async register(
    username: string,
    email: string,
    password: string,
    status: UserStatus = UserStatus.DEACTIVE,
  ) {
    const existEmail = await this.findByEmail(email);

    if (existEmail) throw new BadRequestException('邮箱已注册');

    // 加密
    const hashPassword = await hash(password, this.slat);
    // 创建
    const user = await this.prismaService.user.create({
      data: {
        username,
        email,
        password: hashPassword,
        status,
        role: {
          connect: {
            // 设置默认权限
            roleCode: RoleCode.USER,
          },
        },
      },
    });

    return user;
  }

  getUserInfo(user: User) {
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

  async activateUser(userId: string, expectedSessionVersion: number) {
    const result = await this.prismaService.user.updateMany({
      where: {
        id: userId,
        deleted: false,
        status: UserStatus.DEACTIVE,
        sessionVersion: expectedSessionVersion,
      },
      data: { status: UserStatus.ACTIVE },
    });
    if (result.count !== 1)
      throw new BadRequestException('激活链接无效或已过期');
    await this.evictAuthUser(userId);
  }

  // 重置密码(密码修改后撤销旧的 session)
  async resetPassword(
    userId: string,
    newPassword: string,
    expectedSessionVersion: number,
  ) {
    const password = await hash(newPassword, this.slat);
    const result = await this.prismaService.user.updateMany({
      where: {
        id: userId,
        deleted: false,
        status: UserStatus.ACTIVE,
        sessionVersion: expectedSessionVersion,
      },
      data: {
        password,
        sessionVersion: {
          increment: 1,
        },
      },
    });
    if (result.count !== 1)
      throw new BusinessException(
        'PASSWORD_RESET_INVALID',
        PASSWORD_RESET_INVALID_MESSAGE,
      );

    // 清空用户缓存
    await this.evictAuthUser(userId);
    return true;
  }

  // 获取会话数量
  async getSessionVersion(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        deleted: false,
        role: { status: 1 },
      },
      select: {
        sessionVersion: true,
      },
    });

    // 用户不存在或禁用
    if (!user) return null;

    return user.sessionVersion;
  }

  // 撤销全部会话
  async bumpSessionVersion(userId: string) {
    const res = await this.prismaService.user.updateMany({
      where: { id: userId },
      data: {
        sessionVersion: {
          increment: 1,
        },
      },
    });

    if (res.count !== 1) {
      return null;
    }

    await this.evictAuthUser(userId);

    const updated = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        sessionVersion: true,
      },
    });

    return updated?.sessionVersion ?? null;
  }
}
