import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { RoleCode } from '../../common/constants';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withSerializable } from '../../common/prisma/transaction';
import { Prisma } from '../../prisma/generated/prisma/client';
import { mediaAssetWhere, requireOwnedAssets } from '../assets/asset-scope';
import { AssetsService } from '../assets/assets.service';
import {
  thumbnailRevision,
  thumbnailRevisionSelect,
} from '../assets/asset-media';
import type { RequestUser } from '../iam/auth/auth.type';
import {
  albumAccessInclude,
  albumPermissions,
  albumWhere,
  requireAlbumAccess,
} from './album-scope';
import { rethrowCollectionError } from './collection-errors';
import {
  AlbumMemberPermissionsDto,
  InviteAlbumMemberDto,
} from './dto/album-members.dto';
import { CreateAlbumDto, UpdateAlbumDto } from './dto/collections.dto';
import { normalizeAlbumCover } from './album-cover';

function albumInclude(userId: string) {
  return {
    ...albumAccessInclude(userId),
    coverAsset: {
      where: mediaAssetWhere(),
      select: { id: true, ...thumbnailRevisionSelect },
    },
    assets: {
      where: { asset: mediaAssetWhere() },
      select: { assetId: true, asset: { select: thumbnailRevisionSelect } },
      orderBy: [{ asset: { createdAt: 'desc' } }, { assetId: 'desc' }],
      take: 1,
    },
    _count: {
      select: {
        assets: { where: { asset: mediaAssetWhere() } },
        members: true,
      },
    },
  } satisfies Prisma.AlbumInclude;
}

type AlbumRow = Prisma.AlbumGetPayload<{
  include: ReturnType<typeof albumInclude>;
}>;

const memberSelect = {
  userId: true,
  canAdd: true,
  canEdit: true,
  canRemove: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { username: true, email: true } },
} satisfies Prisma.AlbumMemberSelect;

type MemberRow = Prisma.AlbumMemberGetPayload<{ select: typeof memberSelect }>;

@Injectable()
export class AlbumsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async list(userId: string) {
    const albums = await this.prisma.album.findMany({
      where: albumWhere(userId),
      include: albumInclude(userId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return albums.map((album) => this.summary(album, userId));
  }

  async getSummary(
    albumId: string,
    userId: string,
    transaction: Prisma.TransactionClient = this.prisma,
  ) {
    const album = await transaction.album.findFirst({
      where: { id: albumId, ...albumWhere(userId) },
      include: albumInclude(userId),
    });

    if (!album) {
      throw new NotFoundException('相册不存在');
    }

    return this.summary(album, userId);
  }

  async detail(albumId: string, userId: string, query: CursorPaginationDto) {
    return {
      ...(await this.getSummary(albumId, userId)),
      assets: await this.assets.list(userId, { ...query, albumId }),
    };
  }

  async create(user: RequestUser, body: CreateAlbumDto) {
    const coverImage =
      body.coverImage == null
        ? body.coverImage
        : await normalizeAlbumCover(body.coverImage);
    return withSerializable(this.prisma, async (transaction) => {
      if (body.shared) {
        const administrator = await transaction.user.findFirst({
          where: {
            id: user.id,
            sessionVersion: user.sessionVersion,
            deleted: false,
            status: 'ACTIVE',
            role: { roleCode: RoleCode.ADMIN, status: 1 },
          },
          select: { id: true },
        });
        if (!administrator)
          throw new ForbiddenException('仅管理员可以创建共享相册');
      }
      const album = await transaction.album.create({
        data: {
          ownerId: user.id,
          name: body.name,
          description: body.description,
          shared: body.shared ?? false,
          coverImage,
        },
        include: albumInclude(user.id),
      });
      return this.summary(album, user.id);
    }).catch((error: unknown) => rethrowCollectionError(error, '相册'));
  }

  async update(albumId: string, userId: string, body: UpdateAlbumDto) {
    if (
      body.name === undefined &&
      body.description === undefined &&
      body.coverAssetId === undefined &&
      body.coverImage === undefined
    ) {
      throw new BadRequestException('至少提供一个要更新的相册字段');
    }

    if (body.coverImage != null && body.coverAssetId != null) {
      throw new BadRequestException('自定义图片和相册资源不能同时设为封面');
    }
    const coverImage =
      body.coverImage == null
        ? body.coverImage
        : await normalizeAlbumCover(body.coverImage);

    return withSerializable(this.prisma, async (transaction) => {
      await requireAlbumAccess(transaction, albumId, userId, 'edit');

      if (body.coverAssetId !== undefined && body.coverAssetId !== null) {
        const member = await transaction.albumAsset.findFirst({
          where: {
            albumId,
            assetId: body.coverAssetId,
            asset: mediaAssetWhere(),
          },
          select: { assetId: true },
        });

        if (!member) {
          throw new BadRequestException('封面必须是相册中的未删除资产');
        }
      }

      const album = await transaction.album.update({
        where: { id: albumId },
        data: {
          name: body.name,
          description: body.description,
          coverAssetId: coverImage ? null : body.coverAssetId,
          coverImage:
            coverImage !== undefined
              ? coverImage
              : body.coverAssetId !== undefined
                ? null
                : undefined,
        },
        include: albumInclude(userId),
      });

      return this.summary(album, userId);
    }).catch((error: unknown) => rethrowCollectionError(error, '相册'));
  }

  remove(albumId: string, userId: string) {
    return withSerializable(this.prisma, async (transaction) => {
      await requireAlbumAccess(transaction, albumId, userId, 'deleteAlbum');

      return transaction.album.delete({
        where: { id: albumId },
        select: { id: true },
      });
    }).catch((error: unknown) => rethrowCollectionError(error, '相册'));
  }

  addAssets(albumId: string, userId: string, ids: string[]) {
    return withSerializable(this.prisma, async (transaction) => {
      await requireAlbumAccess(transaction, albumId, userId, 'addAssets');
      await requireOwnedAssets(transaction, userId, ids);

      const result = await transaction.albumAsset.createMany({
        data: ids.map((assetId) => ({ albumId, assetId })),
        skipDuplicates: true,
      });

      const album =
        result.count > 0
          ? await transaction.album.update({
              where: { id: albumId },
              data: { updatedAt: new Date() },
              include: albumInclude(userId),
            })
          : await transaction.album.findUniqueOrThrow({
              where: { id: albumId },
              include: albumInclude(userId),
            });

      return { ...result, album: this.summary(album, userId) };
    });
  }

  removeAssets(albumId: string, userId: string, ids: string[]) {
    return withSerializable(this.prisma, async (transaction) => {
      const album = await requireAlbumAccess(
        transaction,
        albumId,
        userId,
        'removeAssets',
      );

      const result = await transaction.albumAsset.deleteMany({
        where: { albumId, assetId: { in: ids } },
      });

      const updated =
        result.count > 0
          ? await transaction.album.update({
              where: { id: albumId },
              data: {
                updatedAt: new Date(),
                ...(ids.includes(album.coverAssetId)
                  ? { coverAssetId: null }
                  : {}),
              },
              include: albumInclude(userId),
            })
          : await transaction.album.findUniqueOrThrow({
              where: { id: albumId },
              include: albumInclude(userId),
            });

      return { ...result, album: this.summary(updated, userId) };
    });
  }

  renameAsset(albumId: string, assetId: string, userId: string, name: string) {
    return this.assets.rename(assetId, userId, name, albumId);
  }

  listMembers(albumId: string, userId: string) {
    return withSerializable(this.prisma, async (transaction) => {
      await requireAlbumAccess(transaction, albumId, userId, 'manageMembers');
      const members = await transaction.albumMember.findMany({
        where: { albumId },
        select: memberSelect,
        orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
        take: 200,
      });
      return members.map((member) => this.memberSummary(member));
    });
  }

  inviteMember(albumId: string, userId: string, body: InviteAlbumMemberDto) {
    return withSerializable(this.prisma, async (transaction) => {
      const album = await requireAlbumAccess(
        transaction,
        albumId,
        userId,
        'manageMembers',
      );
      const invited = await transaction.user.findFirst({
        where: {
          email: { equals: body.email, mode: 'insensitive' },
          deleted: false,
          status: 'ACTIVE',
          role: { status: 1 },
        },
        select: { id: true },
      });
      if (!invited) throw new NotFoundException('该邮箱没有可用的已注册用户');
      if (invited.id === album.ownerId)
        throw new BadRequestException('相册创建者无需邀请');
      const existing = await transaction.albumMember.findUnique({
        where: { albumId_userId: { albumId, userId: invited.id } },
        select: { userId: true },
      });
      if (existing)
        throw new ConflictException('该用户已加入相册，请修改成员权限');
      if ((await transaction.albumMember.count({ where: { albumId } })) >= 200)
        throw new BadRequestException('每个共享相册最多邀请 200 名成员');
      const member = await transaction.albumMember
        .create({
          data: {
            albumId,
            userId: invited.id,
            ...this.memberPermissions(body),
          },
          select: memberSelect,
        })
        .catch((error: unknown) => {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          )
            throw new ConflictException('该用户已加入相册，请修改成员权限');
          throw error;
        });
      await this.auditMember(
        transaction,
        albumId,
        userId,
        invited.id,
        'album.member.invite',
        body,
      );
      return {
        member: this.memberSummary(member),
        album: await this.touchAlbum(transaction, albumId, userId),
      };
    });
  }

  updateMember(
    albumId: string,
    userId: string,
    memberId: string,
    body: AlbumMemberPermissionsDto,
  ) {
    return withSerializable(this.prisma, async (transaction) => {
      await requireAlbumAccess(transaction, albumId, userId, 'manageMembers');
      const existing = await transaction.albumMember.findUnique({
        where: { albumId_userId: { albumId, userId: memberId } },
        select: { userId: true },
      });
      if (!existing) throw new NotFoundException('相册成员不存在');
      const member = await transaction.albumMember.update({
        where: { albumId_userId: { albumId, userId: memberId } },
        data: this.memberPermissions(body),
        select: memberSelect,
      });
      await this.auditMember(
        transaction,
        albumId,
        userId,
        memberId,
        'album.member.update',
        body,
      );
      return {
        member: this.memberSummary(member),
        album: await this.touchAlbum(transaction, albumId, userId),
      };
    });
  }

  removeMember(albumId: string, userId: string, memberId: string) {
    return withSerializable(this.prisma, async (transaction) => {
      await requireAlbumAccess(transaction, albumId, userId, 'manageMembers');
      const result = await transaction.albumMember.deleteMany({
        where: { albumId, userId: memberId },
      });
      if (result.count)
        await this.auditMember(
          transaction,
          albumId,
          userId,
          memberId,
          'album.member.remove',
        );
      return {
        userId: memberId,
        album: await this.touchAlbum(transaction, albumId, userId),
      };
    });
  }

  private memberPermissions(body: AlbumMemberPermissionsDto) {
    return {
      canAdd: body.canAdd,
      canEdit: body.canEdit,
      canRemove: body.canRemove,
    };
  }

  private memberSummary(member: MemberRow) {
    return {
      userId: member.userId,
      username: member.user.username,
      email: member.user.email,
      ...this.memberPermissions(member),
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  }

  private async auditMember(
    transaction: Prisma.TransactionClient,
    albumId: string,
    actorId: string,
    memberId: string,
    action: string,
    permissions?: AlbumMemberPermissionsDto,
  ) {
    await transaction.auditLog.create({
      data: {
        actorId,
        action,
        entityType: 'Album',
        entityId: albumId,
        metadataJson: {
          userId: memberId,
          ...(permissions ? this.memberPermissions(permissions) : {}),
        },
      },
    });
  }

  private async touchAlbum(
    transaction: Prisma.TransactionClient,
    albumId: string,
    userId: string,
  ) {
    const album = await transaction.album.update({
      where: { id: albumId },
      data: { updatedAt: new Date() },
      include: albumInclude(userId),
    });
    return this.summary(album, userId);
  }

  private summary(album: AlbumRow, userId: string) {
    const coverAssetId = album.coverImage
      ? null
      : (album.coverAsset?.id ?? album.assets[0]?.assetId ?? null);

    return {
      id: album.id,
      name: album.name,
      description: album.description,
      shared: album.shared,
      owner: { id: album.owner.id, username: album.owner.username },
      memberCount: album._count.members,
      permissions: albumPermissions(album, userId),
      coverSource: album.coverImage
        ? 'custom'
        : album.coverAsset
          ? 'asset'
          : 'auto',
      coverAssetId,
      coverThumbnailRevision: album.coverImage
        ? null
        : thumbnailRevision(album.coverAsset ?? album.assets[0]?.asset),
      coverUrl:
        album.coverImage ??
        (coverAssetId ? this.assets.thumbnailUrl(coverAssetId) : null),
      count: album._count.assets,
      createdAt: album.createdAt.toISOString(),
      updatedAt: album.updatedAt.toISOString(),
    };
  }
}
