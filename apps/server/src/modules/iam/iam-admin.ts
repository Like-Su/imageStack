import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RoleCode, PermissionCodeList } from '../../common/constants';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withSerializable } from '../../common/prisma/transaction';
import { Prisma, UserStatus } from '../../prisma/generated/prisma/client';
import type { RequestUser } from './auth/auth.type';

export const builtinRoles = new Set<string>(Object.values(RoleCode));
export const builtinPermissions = new Set<string>(PermissionCodeList);

export const permissionSelect = {
  id: true,
  permissionName: true,
  permissionCode: true,
  parentId: true,
} satisfies Prisma.PermissionSelect;

export const roleSelect = {
  id: true,
  roleName: true,
  roleCode: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  permissions: { select: { permission: { select: permissionSelect } } },
  _count: { select: { users: { where: { deleted: false } } } },
} satisfies Prisma.RoleSelect;

export function roleSummary(
  role: Prisma.RoleGetPayload<{ select: typeof roleSelect }>,
) {
  const { permissions, _count, ...fields } = role;
  return {
    ...fields,
    builtin: builtinRoles.has(role.roleCode),
    userCount: _count.users,
    permissions: permissions.map((entry) => entry.permission),
  };
}

export async function resolvePermissions(
  transaction: Prisma.TransactionClient,
  codes: string[],
) {
  const uniqueCodes = [...new Set(codes)];
  const permissions = await transaction.permission.findMany({
    where: { permissionCode: { in: uniqueCodes } },
    select: permissionSelect,
  });
  if (permissions.length !== uniqueCodes.length)
    throw new BadRequestException('所选权限不存在，请刷新后重试');
  return permissions;
}

export async function requireRole(
  transaction: Prisma.TransactionClient,
  roleId: string,
) {
  const role = await transaction.role.findUnique({ where: { id: roleId } });
  if (!role) throw new NotFoundException('角色不存在');
  return role;
}

export async function recordIamAudit(
  transaction: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Prisma.InputJsonObject = {},
) {
  await transaction.auditLog.create({
    data: { actorId, action, entityType, entityId, metadataJson: metadata },
  });
}

export async function withIamMutation<Result>(
  prisma: PrismaService,
  actor: RequestUser,
  work: (transaction: Prisma.TransactionClient) => Promise<Result>,
): Promise<Result> {
  try {
    return await withSerializable(prisma, async (transaction) => {
      const administrator = await transaction.user.findFirst({
        where: {
          id: actor.id,
          sessionVersion: actor.sessionVersion ?? 0,
          status: UserStatus.ACTIVE,
          deleted: false,
          role: { roleCode: RoleCode.ADMIN, status: 1 },
        },
        select: { id: true },
      });
      if (!administrator)
        throw new ForbiddenException('仅管理员可以管理用户、角色和权限');
      return work(transaction);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ConflictException('名称、邮箱或编码已存在');
      if (error.code === 'P2003')
        throw new ConflictException('记录仍被引用，请先解除关联');
      if (error.code === 'P2025')
        throw new NotFoundException('记录不存在或已被删除');
      if (error.code === 'P2034')
        throw new ConflictException('数据已变化，请刷新后重试');
    }
    throw error;
  }
}
