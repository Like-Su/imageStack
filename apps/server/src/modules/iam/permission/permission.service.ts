import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class PermissionService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    permissionName: string,
    permissionCode: string,
    parentId?: string,
  ) {
    const exists =
      (await this.prismaService.permission.count({
        where: {
          permissionCode,
          permissionName,
        },
      })) > 0;
    if (exists) throw new BadRequestException('已经存在该权限');

    return await this.prismaService.permission.create({
      data: {
        permissionName,
        permissionCode,
        parentId: parentId ? parentId : undefined,
      },
    });
  }

  // 修改
  async edit(
    permissionId: string,
    permissionName: string,
    permissionCode: string,
  ) {
    await this.prismaService.permission.findFirstOrThrow({
      where: { id: permissionId },
    });

    return await this.prismaService.permission.update({
      where: {
        id: permissionId,
      },
      data: {
        permissionName,
        permissionCode,
      },
    });
  }

  async del(permissionId: string) {
    await this.prismaService.permission.findFirstOrThrow({
      where: { id: permissionId },
    });
    return await this.prismaService.permission.delete({
      where: {
        id: permissionId,
      },
    });
  }
}
