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
    assets: {
      where: { asset: assetWhere(userId) },
      select: { assetId: true },
      orderBy: [
        { asset: { createdAt: 'desc' as const } },
        { assetId: 'desc' as const },
      ],
      take: 1,
    },
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

  async detail(tagId: string, userId: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, ownerId: userId },
      include: tagInclude(userId),
    });
    if (!tag) throw new NotFoundException('标签不存在');
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
      await transaction.$executeRaw`
        INSERT INTO "AssetTag" ("assetId", "tagId", "addedAt")
        SELECT link."assetId", ${target.id}, CURRENT_TIMESTAMP
        FROM "AssetTag" link
        JOIN "FileNode" asset ON asset."id" = link."assetId"
        WHERE link."tagId" = ${tagId} AND asset."ownerId" = ${userId}
        ON CONFLICT ("assetId", "tagId") DO NOTHING
      `;

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

  async addToAsset(assetId: string, userId: string, names: string[]) {
    const result = await this.addToAssets([assetId], userId, names);
    return { tags: result.tags, createdCount: result.createdCount };
  }

  addToAssets(assetIds: string[], userId: string, names: string[]) {
    const uniqueNames = [...new Set(names)];

    return withSerializable(this.prisma, async (transaction) => {
      await requireOwnedAssets(transaction, userId, assetIds);

      const created = await transaction.tag.createMany({
        data: uniqueNames.map((name) => ({ ownerId: userId, name })),
        skipDuplicates: true,
      });

      const selected = await transaction.tag.findMany({
        where: { ownerId: userId, name: { in: uniqueNames } },
        select: { id: true },
      });

      await transaction.assetTag.createMany({
        data: assetIds.flatMap((assetId) =>
          selected.map(({ id }) => ({ assetId, tagId: id })),
        ),
        skipDuplicates: true,
      });

      const tags = await transaction.tag.findMany({
        where: {
          ownerId: userId,
          assets: { some: { assetId: { in: assetIds } } },
        },
        include: tagInclude(userId),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });

      const links = await transaction.assetTag.findMany({
        where: { assetId: { in: assetIds }, tag: { ownerId: userId } },
        select: { assetId: true, tagId: true },
        orderBy: { tag: { name: 'asc' } },
      });
      const memberships = new Map(assetIds.map((id) => [id, [] as string[]]));
      for (const link of links) memberships.get(link.assetId)!.push(link.tagId);
      return {
        assets: assetIds.map((id) => ({ id, tagIds: memberships.get(id)! })),
        tags: tags.map((tag) => this.summary(tag)),
        createdCount: created.count,
      };
    });
  }

  removeFromAsset(assetId: string, tagId: string, userId: string) {
    return this.removeFromAssets([assetId], tagId, userId);
  }

  removeFromAssets(assetIds: string[], tagId: string, userId: string) {
    return withSerializable(this.prisma, async (transaction) => {
      await requireOwnedAssets(transaction, userId, assetIds);
      await this.requireOwned(transaction, tagId, userId);

      const result = await transaction.assetTag.deleteMany({
        where: { assetId: { in: assetIds }, tagId },
      });
      const tag = await transaction.tag.findUniqueOrThrow({
        where: { id: tagId, ownerId: userId },
        include: tagInclude(userId),
      });
      return { ...result, tag: this.summary(tag) };
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
      coverAssetId: tag.assets[0]?.assetId ?? null,
    };
  }
}
