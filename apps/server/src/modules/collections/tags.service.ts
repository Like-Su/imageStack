import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withSerializable } from '../../common/prisma/transaction';
import type { Prisma } from '../../prisma/generated/prisma/client';
import { assetWhere, requireOwnedAssets } from '../assets/asset-scope';
import { rethrowCollectionError } from './collection-errors';
import { CreateTagDto, UpdateTagDto } from './dto/collections.dto';

function tagInclude(userId: string) {
  return {
    _count: {
      select: { assets: { where: { asset: assetWhere(userId) } } },
    },
  } satisfies Prisma.TagInclude;
}

type TagRow = Prisma.TagGetPayload<{
  include: ReturnType<typeof tagInclude>;
}>;

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const tags = await this.prisma.tag.findMany({
      where: { ownerId: userId },
      include: tagInclude(userId),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    return tags.map((tag) => this.summary(tag));
  }

  async create(userId: string, body: CreateTagDto) {
    const tag = await this.prisma.tag
      .create({
        data: { ownerId: userId, name: body.name },
        include: tagInclude(userId),
      })
      .catch((error: unknown) => rethrowCollectionError(error, '标签'));

    return this.summary(tag);
  }

  update(tagId: string, userId: string, body: UpdateTagDto) {
    if ((body.name !== undefined) === (body.mergeIntoId !== undefined)) {
      throw new BadRequestException('请选择标签改名或合并中的一个操作');
    }

    if (body.mergeIntoId === tagId) {
      throw new BadRequestException('不能将标签合并到自身');
    }

    return withSerializable(this.prisma, async (transaction) => {
      await this.requireOwned(transaction, tagId, userId);

      if (body.name !== undefined) {
        const tag = await transaction.tag.update({
          where: { id: tagId, ownerId: userId },
          data: { name: body.name },
          include: tagInclude(userId),
        });

        return this.summary(tag);
      }

      const target = await this.requireOwned(
        transaction,
        body.mergeIntoId,
        userId,
      );
      const links = await transaction.assetTag.findMany({
        where: { tagId, asset: { ownerId: userId } },
        select: { assetId: true },
      });

      if (links.length > 0) {
        await transaction.assetTag.createMany({
          data: links.map(({ assetId }) => ({ assetId, tagId: target.id })),
          skipDuplicates: true,
        });
      }

      await transaction.tag.delete({
        where: { id: tagId, ownerId: userId },
      });

      const tag = await transaction.tag.findUniqueOrThrow({
        where: { id: target.id, ownerId: userId },
        include: tagInclude(userId),
      });

      return this.summary(tag);
    }).catch((error: unknown) => rethrowCollectionError(error, '标签'));
  }

  remove(tagId: string, userId: string) {
    return withSerializable(this.prisma, async (transaction) => {
      await this.requireOwned(transaction, tagId, userId);

      return transaction.tag.delete({
        where: { id: tagId, ownerId: userId },
        select: { id: true },
      });
    }).catch((error: unknown) => rethrowCollectionError(error, '标签'));
  }

  addToAsset(assetId: string, userId: string, names: string[]) {
    const uniqueNames = [...new Set(names)];

    return withSerializable(this.prisma, async (transaction) => {
      await requireOwnedAssets(transaction, userId, [assetId]);

      await transaction.tag.createMany({
        data: uniqueNames.map((name) => ({ ownerId: userId, name })),
        skipDuplicates: true,
      });

      const selected = await transaction.tag.findMany({
        where: { ownerId: userId, name: { in: uniqueNames } },
        select: { id: true },
      });

      await transaction.assetTag.createMany({
        data: selected.map(({ id }) => ({ assetId, tagId: id })),
        skipDuplicates: true,
      });

      const tags = await transaction.tag.findMany({
        where: { ownerId: userId, assets: { some: { assetId } } },
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });

      return {
        tags: tags.map((tag) => ({ ...tag, source: 'MANUAL' as const })),
      };
    });
  }

  removeFromAsset(assetId: string, tagId: string, userId: string) {
    return withSerializable(this.prisma, async (transaction) => {
      await requireOwnedAssets(transaction, userId, [assetId]);
      await this.requireOwned(transaction, tagId, userId);

      return transaction.assetTag.deleteMany({
        where: { assetId, tagId },
      });
    });
  }

  private async requireOwned(
    transaction: Prisma.TransactionClient,
    tagId: string,
    userId: string,
  ) {
    const tag = await transaction.tag.findFirst({
      where: { id: tagId, ownerId: userId },
      select: { id: true },
    });

    if (!tag) {
      throw new NotFoundException('标签不存在');
    }

    return tag;
  }

  private summary(tag: TagRow) {
    return {
      id: tag.id,
      name: tag.name,
      source: 'MANUAL' as const,
      count: tag._count.assets,
    };
  }
}
