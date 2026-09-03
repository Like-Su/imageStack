import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import {
  RoleUpdateInput,
  RoleWhereInput,
} from 'src/prisma/generated/prisma/models';
import { UserService } from '../user/user.service';

@Injectable()
export class RoleService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
  ) {}

  // 创建角色
  async create(roleName: string, roleCode: string, description?: string) {
    const existRole = this.prismaService.role.findFirst({
      where: {
        OR: [{ roleName }, { roleCode }],
      },
    });

    if (existRole) throw new BadRequestException('角色名称或编码重复');

    return await this.prismaService.role.create({
      data: {
        roleName,
        roleCode,
        description,
        status: 1,
      },
    });
  }

  // 修改 角色 权限,名称, 权限编码
  async edit(
    roleId: string,
    roleName?: string,
    roleCode?: string,
    description?: string,
  ) {
    const data = {} as RoleUpdateInput;
    roleName && (data.roleName = roleName);
    roleCode && (data.roleCode = roleCode);
    description && (data.description = description);

    return await this.prismaService.role.update({
      where: { id: roleId },
      data,
    });
  }

  // 修改角色权限
  async replacePermissions(roleId: string, permissionCodes: string[]) {
    // 去除首位空格
    const codes = [...new Set(permissionCodes.map((code) => code.trim()))];

    // 是否有空的权限编码
    if (codes.some((code) => !code))
      throw new BadRequestException('权限编码不能为空');

    // 角色查询
    const role = await this.prismaService.role.findUnique({
      where: {
        id: roleId,
      },
      select: {
        id: true,
        roleCode: true,
        status: true,
      },
    });

    if (!role) throw new NotFoundException('角色不存在');

    // 角色被禁用时不允许修改权限
    if (role.status !== 1) {
      throw new BadRequestException('角色已禁用');
    }

    // 查询所有权限
    const permissions = await this.prismaService.permission.findMany({
      where: {
        permissionCode: {
          in: codes,
        },
      },
      select: {
        id: true,
        permissionCode: true,
      },
    });

    // 检查是否存在不存在的权限编码
    const foundCodes = new Set(
      permissions.map((permission) => permission.permissionCode),
    );

    const missingCodes = codes.filter((code) => !foundCodes.has(code));

    if (missingCodes.length > 0) {
      throw new BadRequestException(
        `以下权限不存在 ${missingCodes.join(', ')}`,
      );
    }

    // 更新角色权限
    const updatedRole = await this.prismaService.$transaction(async (tx) => {
      // 删除旧权限关系
      await tx.rolePermission.deleteMany({
        where: {
          roleId,
        },
      });

      // 写入新权限关系
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            permissionId: permission.id,
          })),
        });
      }

      // 查询最新结果
      return tx.role.findUnique({
        where: {
          id: roleId,
        },
        select: {
          id: true,
          roleName: true,
          roleCode: true,
          permissions: {
            select: {
              permission: {
                select: {
                  id: true,
                  permissionName: true,
                  permissionCode: true,
                  parentId: true,
                },
              },
            },
          },
        },
      });
    });

    if (!updatedRole) throw new NotFoundException('角色不存在');

    await this.userService.evictAuthUsersByRole(roleId);

    return {
      id: updatedRole.id,
      roleName: updatedRole.roleName,
      roleCode: updatedRole.roleCode,
      permissions: updatedRole.permissions.map((item) => item.permission),
    };
  }

  // 获取角色信息
  async getRoleInfo(
    roleId: string,
    status: number = 1,
    roleName?: string,
    roleCode?: string,
  ) {
    const where = { id: roleId, status } as RoleWhereInput;
    roleName && (where.roleName = roleName);
    roleCode && (where.roleCode = roleCode);
    return await this.prismaService.role.findFirst({
      where,
    });
  }

  // 查询角色拥有的权限
  async getRolePermission(roleId: string) {
    const role = await this.prismaService.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        roleName: true,
        roleCode: true,
        permissions: { select: { permission: true } },
      },
    });

    if (!role) throw new NotFoundException('角色不存在');

    return {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };
  }

  // 查询角色下的用户与用户数量
  async getRoleUser(roleId: string) {
    const where = { roleId, deleted: false };
    const [total, users] = await this.prismaService.$transaction([
      this.prismaService.user.count({ where }),
      this.prismaService.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      total,
      users,
    };
  }

  // 角色列表
  listRoles(pageSize: number, limit: number, status: number = 1) {
    return this.prismaService.role.findMany({
      take: limit,
      skip: (pageSize - 1) * limit,
      where: {
        status,
      },
    });
  }
}
