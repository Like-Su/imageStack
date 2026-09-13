import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Prisma, UserStatus } from '../../../prisma/generated/prisma/client';
import { RoleCode } from '../../../common/constants';
import type { RequestUser } from '../auth/auth.type';
import {
  permissionSelect,
  recordIamAudit,
  requireRole,
  resolvePermissions,
  withIamMutation,
} from '../iam-admin';
import { CreateUserDto, ListUsersDto, UpdateUserDto } from './dto/user.dto';

const userSelect = {
  id: true,
  username: true,
  email: true,
  avatar: true,
  status: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  role: {
    select: {
      id: true,
      roleName: true,
      roleCode: true,
      status: true,
      permissions: { select: { permission: { select: permissionSelect } } },
    },
  },
  permissions: { select: { permission: { select: permissionSelect } } },
} satisfies Prisma.UserSelect;

const userListSelect = {
  ...userSelect,
  avatar: false,
} satisfies Prisma.UserSelect;

function summary(
  user: Prisma.UserGetPayload<{ select: typeof userListSelect }> & {
    avatar?: string | null;
  },
) {
  const { permissions, role, ...fields } = user;
  const directPermissions = permissions.map((entry) => entry.permission);
  const rolePermissions = role.permissions.map((entry) => entry.permission);
  const accessEnabled = user.status === UserStatus.ACTIVE && role.status === 1;
  return {
    ...fields,
    role: { ...role, permissions: rolePermissions },
    directPermissions,
    hasAllPermissions: accessEnabled && role.roleCode === RoleCode.ADMIN,
    effectivePermissionCodes: accessEnabled
      ? [
          ...new Set(
            [...rolePermissions, ...directPermissions].map(
              (permission) => permission.permissionCode,
            ),
          ),
        ].sort()
      : [],
  };
}

@Injectable()
export class UserManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersDto) {
    const where: Prisma.UserWhereInput = {
      deleted: false,
      status: query.status,
      roleId: query.roleId,
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, users] = await this.prisma.$transaction(
      [
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          select: userListSelect,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      items: users.map(summary),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async create(actor: RequestUser, body: CreateUserDto) {
    const password = await hash(body.password, 10);
    return withIamMutation(this.prisma, actor, async (transaction) => {
      const role = body.roleId
        ? await requireRole(transaction, body.roleId)
        : await transaction.role.findUnique({
            where: { roleCode: RoleCode.USER },
          });
      if (!role || role.status !== 1)
        throw new BadRequestException('请选择启用的角色');
      const permissions = await resolvePermissions(
        transaction,
        body.permissionCodes ?? [],
      );
      const existingEmail = await transaction.user.count({
        where: { email: { equals: body.email, mode: 'insensitive' } },
      });
      if (existingEmail) throw new BadRequestException('邮箱已注册');
      const user = await transaction.user.create({
        data: {
          username: body.username,
          email: body.email,
          password,
          status: body.status ?? UserStatus.ACTIVE,
          roleId: role.id,
          permissions: {
            create: permissions.map((permission) => ({
              permissionId: permission.id,
            })),
          },
        },
        select: userSelect,
      });
      await recordIamAudit(
        transaction,
        actor.id,
        'iam.user.create',
        'User',
        user.id,
        {
          roleId: role.id,
          permissionCodes: body.permissionCodes ?? [],
          status: user.status,
        },
      );
      return summary(user);
    });
  }

  async update(actor: RequestUser, userId: string, body: UpdateUserDto) {
    if (!Object.values(body).some((value) => value !== undefined))
      throw new BadRequestException('请至少修改一个字段');
    const password =
      body.password === undefined ? undefined : await hash(body.password, 10);
    return withIamMutation(this.prisma, actor, async (transaction) => {
      const user = await transaction.user.findFirst({
        where: { id: userId, deleted: false },
        include: { role: true },
      });
      if (!user) throw new NotFoundException('用户不存在');
      const role =
        body.roleId === undefined
          ? user.role
          : await requireRole(transaction, body.roleId);
      if (
        body.roleId !== undefined &&
        role.id !== user.roleId &&
        role.status !== 1
      )
        throw new BadRequestException('请选择启用的角色');
      const nextStatus = body.status ?? user.status;
      if (
        actor.id === userId &&
        (nextStatus !== UserStatus.ACTIVE || role.roleCode !== RoleCode.ADMIN)
      )
        throw new BadRequestException('不能停用自己或移除自己的管理员角色');
      if (
        user.role.roleCode === RoleCode.ADMIN &&
        user.status === UserStatus.ACTIVE &&
        (nextStatus !== UserStatus.ACTIVE || role.roleCode !== RoleCode.ADMIN)
      ) {
        const administrators = await transaction.user.count({
          where: {
            deleted: false,
            status: UserStatus.ACTIVE,
            role: { roleCode: RoleCode.ADMIN, status: 1 },
          },
        });
        if (administrators <= 1)
          throw new BadRequestException('必须保留至少一名启用的管理员');
      }
      if (
        body.email !== undefined &&
        (await transaction.user.count({
          where: {
            id: { not: userId },
            email: { equals: body.email, mode: 'insensitive' },
          },
        }))
      )
        throw new BadRequestException('邮箱已注册');
      const permissions =
        body.permissionCodes === undefined
          ? undefined
          : await resolvePermissions(transaction, body.permissionCodes);
      const updated = await transaction.user.update({
        where: { id: userId },
        data: {
          username: body.username,
          email: body.email,
          password,
          status: body.status,
          roleId: body.roleId,
          sessionVersion: { increment: 1 },
          ...(permissions === undefined
            ? {}
            : {
                permissions: {
                  deleteMany: {},
                  create: permissions.map((permission) => ({
                    permissionId: permission.id,
                  })),
                },
              }),
        },
        select: userSelect,
      });
      await recordIamAudit(
        transaction,
        actor.id,
        'iam.user.update',
        'User',
        userId,
        {
          fields: Object.keys(body).filter((key) => body[key] !== undefined),
          roleId: updated.roleId,
          status: updated.status,
        },
      );
      return summary(updated);
    });
  }

  remove(actor: RequestUser, userId: string) {
    return withIamMutation(this.prisma, actor, async (transaction) => {
      if (userId === actor.id)
        throw new BadRequestException('不能删除当前登录的管理员');
      const user = await transaction.user.findFirst({
        where: { id: userId, deleted: false },
        include: { role: true },
      });
      if (!user) throw new NotFoundException('用户不存在');
      if (
        user.role.roleCode === RoleCode.ADMIN &&
        user.status === UserStatus.ACTIVE &&
        (await transaction.user.count({
          where: {
            deleted: false,
            status: UserStatus.ACTIVE,
            role: { roleCode: RoleCode.ADMIN, status: 1 },
          },
        })) <= 1
      )
        throw new BadRequestException('必须保留至少一名启用的管理员');
      const defaultRole = await transaction.role.findUnique({
        where: { roleCode: RoleCode.USER },
      });
      if (!defaultRole)
        throw new BadRequestException('默认用户角色不存在，请先初始化系统');
      await transaction.user.update({
        where: { id: userId },
        data: {
          deleted: true,
          status: UserStatus.DEACTIVE,
          roleId: defaultRole.id,
          sessionVersion: { increment: 1 },
          permissions: { deleteMany: {} },
        },
      });
      await recordIamAudit(
        transaction,
        actor.id,
        'iam.user.delete',
        'User',
        userId,
      );
      return { id: userId };
    });
  }
}
