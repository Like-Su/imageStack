import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/prisma/client';

export function rethrowCollectionError(
  error: unknown,
  resource: '相册' | '标签',
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ConflictException(`${resource}名称已存在`);
    }

    if (error.code === 'P2025') {
      throw new NotFoundException(`${resource}不存在`);
    }
  }

  throw error;
}
