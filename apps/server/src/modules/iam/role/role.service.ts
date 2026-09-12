import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RoleCode } from '../../../common/constants';
import type { RequestUser } from '../auth/auth.type';
import {
  builtinRoles,
  recordIamAudit,
  requireRole,
  resolvePermissions,
  roleSelect,
  roleSummary,
  withIamMutation,
} from '../iam-admin';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const roles = await this.prisma.role.findMany({
      select: roleSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return roles.map(roleSummary);
  }

  async getRolePermission(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: roleSelect,
    });
    if (!role) throw new NotFoundException('角色不存在');
    return roleSummary(role);
  }

  create(actor: RequestUser, body: CreateRoleDto) {
    return withIamMutation(this.prisma, actor, async (transaction) => {
      if (builtinRoles.has(body.roleCode))
        throw new BadRequestException('内置角色编码不可用于新角色');
      const permissions = await resolvePermissions(
        transaction,
        body.permissionCodes ?? [],
      );
      const role = await transaction.role.create({
        data: {
          roleName: body.roleName,
          roleCode: body.roleCode,
          description: body.description || null,
          status: body.status ?? 1,
          permissions: {
            create: permissions.map((permission) => ({
              permissionId: permission.id,
            })),
          },
        },
        select: roleSelect,
      });
      await recordIamAudit(
        transaction,
        actor.id,
        'iam.role.create',
        'Role',
        role.id,
        { permissionCodes: body.permissionCodes ?? [] },
      );
      return roleSummary(role);
    });
  }

  update(actor: RequestUser, roleId: string, body: UpdateRoleDto) {
    if (!Object.values(body).some((value) => value !== undefined))
      throw new BadRequestException('请至少修改一个字段');
    return withIamMutation(this.prisma, actor, async (transaction) => {
      const role = await requireRole(transaction, roleId);
      if (
        body.roleCode !== undefined &&
        body.roleCode !== role.roleCode &&
        (builtinRoles.has(role.roleCode) || builtinRoles.has(body.roleCode))
      )
        throw new BadRequestException('不能修改内置角色编码');
      if (role.roleCode === RoleCode.ADMIN && body.status === 0)
        throw new BadRequestException('不能停用管理员角色');
      const permissions =
        body.permissionCodes === undefined
          ? undefined
          : await resolvePermissions(transaction, body.permissionCodes);
      const updated = await transaction.role.update({
        where: { id: roleId },
        data: {
          roleName: body.roleName,
          roleCode: body.roleCode,
          status: body.status,
          description:
            body.description === undefined
              ? undefined
              : body.description || null,
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
        select: roleSelect,
      });
      await transaction.user.updateMany({
        where: { roleId, deleted: false },
        data: { sessionVersion: { increment: 1 } },
      });
      await recordIamAudit(
        transaction,
        actor.id,
        'iam.role.update',
        'Role',
        roleId,
        {
          fields: Object.keys(body).filter((key) => body[key] !== undefined),
          permissionCodes: updated.permissions.map(
            (entry) => entry.permission.permissionCode,
          ),
        },
      );
      return roleSummary(updated);
    });
  }

  remove(actor: RequestUser, roleId: string) {
    return withIamMutation(this.prisma, actor, async (transaction) => {
      const role = await requireRole(transaction, roleId);
      if (builtinRoles.has(role.roleCode))
        throw new BadRequestException('不能删除内置角色');
      if (await transaction.user.count({ where: { roleId, deleted: false } }))
        throw new BadRequestException('角色仍关联用户，请先为这些用户更换角色');
      const defaultRole = await transaction.role.findUnique({
        where: { roleCode: RoleCode.USER },
      });
      if (!defaultRole)
        throw new BadRequestException('默认用户角色不存在，请先初始化系统');
      await transaction.user.updateMany({
        where: { roleId, deleted: true },
        data: { roleId: defaultRole.id },
      });
      await transaction.role.delete({ where: { id: roleId } });
      await recordIamAudit(
        transaction,
        actor.id,
        'iam.role.delete',
        'Role',
        roleId,
      );
      return { id: roleId };
    });
  }
}
