import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Prisma } from '../../../prisma/generated/prisma/client';
import type { RequestUser } from '../auth/auth.type';
import {
  builtinPermissions,
  recordIamAudit,
  withIamMutation,
} from '../iam-admin';
import { CreatePermissionDto, UpdatePermissionDto } from './dto/permission.dto';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const permissions = await this.prisma.permission.findMany({
      include: {
        _count: {
          select: {
            roles: true,
            users: { where: { user: { deleted: false } } },
            children: true,
          },
        },
      },
      orderBy: [{ permissionCode: 'asc' }, { id: 'asc' }],
    });
    return permissions.map(({ _count, ...permission }) => ({
      ...permission,
      builtin: builtinPermissions.has(permission.permissionCode),
      roleCount: _count.roles,
      userCount: _count.users,
      childCount: _count.children,
    }));
  }

  private async validateParent(
    transaction: Prisma.TransactionClient,
    parentId?: string | null,
    permissionId?: string,
  ) {
    const visited = new Set<string>(permissionId ? [permissionId] : []);
    let ancestorId = parentId;
    while (ancestorId) {
      if (visited.has(ancestorId))
        throw new BadRequestException('权限层级不能形成循环');
      visited.add(ancestorId);
      const parent = await transaction.permission.findUnique({
        where: { id: ancestorId },
        select: { parentId: true },
      });
      if (!parent) throw new BadRequestException('父级权限不存在');
      ancestorId = parent.parentId;
    }
  }

  private affectedUsers(permissionId: string): Prisma.UserWhereInput {
    return {
      deleted: false,
      OR: [
        { permissions: { some: { permissionId } } },
        { role: { permissions: { some: { permissionId } } } },
      ],
    };
  }

  create(actor: RequestUser, body: CreatePermissionDto) {
    return withIamMutation(this.prisma, actor, async (transaction) => {
      if (builtinPermissions.has(body.permissionCode))
        throw new BadRequestException('内置权限编码不可用于新权限');
      await this.validateParent(transaction, body.parentId);
      const permission = await transaction.permission.create({ data: body });
      await recordIamAudit(
        transaction,
        actor.id,
        'iam.permission.create',
        'Permission',
        permission.id,
      );
      return permission;
    });
  }

  update(actor: RequestUser, permissionId: string, body: UpdatePermissionDto) {
    if (!Object.values(body).some((value) => value !== undefined))
      throw new BadRequestException('请至少修改一个字段');
    return withIamMutation(this.prisma, actor, async (transaction) => {
      const permission = await transaction.permission.findUnique({
        where: { id: permissionId },
      });
      if (!permission) throw new NotFoundException('权限不存在');
      if (
        body.permissionCode !== undefined &&
        body.permissionCode !== permission.permissionCode &&
        (builtinPermissions.has(permission.permissionCode) ||
          builtinPermissions.has(body.permissionCode))
      )
        throw new BadRequestException('不能修改内置权限编码');
      if (body.parentId !== undefined)
        await this.validateParent(transaction, body.parentId, permissionId);
      if (
        body.permissionCode !== undefined &&
        body.permissionCode !== permission.permissionCode
      ) {
        await transaction.user.updateMany({
          where: this.affectedUsers(permissionId),
          data: { sessionVersion: { increment: 1 } },
        });
      }
      const updated = await transaction.permission.update({
        where: { id: permissionId },
        data: body,
      });
      await recordIamAudit(
        transaction,
        actor.id,
        'iam.permission.update',
        'Permission',
        permissionId,
        {
          fields: Object.keys(body).filter((key) => body[key] !== undefined),
        },
      );
      return updated;
    });
  }

  remove(actor: RequestUser, permissionId: string) {
    return withIamMutation(this.prisma, actor, async (transaction) => {
      const permission = await transaction.permission.findUnique({
        where: { id: permissionId },
      });
      if (!permission) throw new NotFoundException('权限不存在');
      if (builtinPermissions.has(permission.permissionCode))
        throw new BadRequestException('不能删除内置权限');
      if (
        await transaction.permission.count({
          where: { parentId: permissionId },
        })
      )
        throw new BadRequestException('请先删除或移动子权限');
      await transaction.user.updateMany({
        where: this.affectedUsers(permissionId),
        data: { sessionVersion: { increment: 1 } },
      });
      await transaction.permission.delete({ where: { id: permissionId } });
      await recordIamAudit(
        transaction,
        actor.id,
        'iam.permission.delete',
        'Permission',
        permissionId,
      );
      return { id: permissionId };
    });
  }
}
