import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, Subject, takeUntil } from 'rxjs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CoalescedReads } from '../../common/coalesced-reads';
import {
  workspaceNotificationResources,
  type WorkspaceNotificationResource,
} from '../../common/workspace-notifications';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { PermissionCode, RedisKey, RoleCode } from '../../common/constants';
import type { RequestUser } from '../iam/auth/auth.type';
import { UserService } from '../iam/user/user.service';
import type { Prisma } from '../../infrastructure/prisma/generated/prisma/client';
import { summaryVideoWhere } from './video-summary.constants';
import { VideoSummaryNotifierService } from './video-summary-notifier.service';
import {
  serializeVideoSummaryState,
  videoSummaryStateSelect,
} from './video-summary-state';

@Injectable()
export class VideoSummaryEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(VideoSummaryEventsService.name);
  private readonly shutdown = new Subject<void>();
  private lastWarningAt = 0;
  private readonly reads = new CoalescedReads();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: VideoSummaryNotifierService,
    private readonly users: UserService,
    private readonly redis: RedisService,
  ) {}

  stream(user: RequestUser, after?: string): Observable<MessageEvent> {
    if (
      after !== undefined &&
      (typeof after !== 'string' ||
        !/^\d{1,19}$/.test(after) ||
        BigInt(after) > 9223372036854775807n)
    )
      throw new BadRequestException('视频总结通知游标无效');
    const where: Prisma.VideoSummaryEventWhereInput = {
      summary: {
        is: { asset: { is: { ...summaryVideoWhere, ownerId: user.id } } },
      },
    };
    return new Observable<MessageEvent>((subscriber) => {
      let cursor = after === undefined ? undefined : BigInt(after);
      let timer: NodeJS.Timeout | undefined;
      let workspaceTimer: NodeJS.Timeout | undefined;
      const workspaceResources = new Set<WorkspaceNotificationResource>();
      let reading = false;
      let requested = false;
      let announced = false;
      let authorizedAt = Date.now();
      let authorization: Promise<boolean> | undefined;
      const authorized = () => {
        if (subscriber.closed) return Promise.resolve(false);
        if (Date.now() - authorizedAt < 45000) return Promise.resolve(true);
        authorization ??= this.authorize(user)
          .then((allowed) => {
            if (allowed) authorizedAt = Date.now();
            else subscriber.complete();
            return allowed;
          })
          .catch(() => {
            subscriber.error(new Error('视频总结通知鉴权暂不可用'));
            return false;
          })
          .finally(() => {
            authorization = undefined;
          });
        return authorization;
      };
      const expiry = setTimeout(
        () => subscriber.complete(),
        Math.max(1, Math.min(2147483647, user.tokenExp * 1000 - Date.now())),
      );
      const heartbeat = setInterval(() => {
        void authorized().then((allowed) => {
          if (allowed && !subscriber.closed)
            subscriber.next({
              type: 'heartbeat',
              data: { time: Date.now() },
            });
        });
      }, 15000);
      heartbeat.unref();

      const wakeWorkspace = (
        resources: readonly WorkspaceNotificationResource[],
      ) => {
        if (subscriber.closed) return;
        for (const resource of resources) workspaceResources.add(resource);
        if (workspaceTimer) return;
        workspaceTimer = setTimeout(() => {
          workspaceTimer = undefined;
          void authorized().then((allowed) => {
            if (!allowed || subscriber.closed || !workspaceResources.size)
              return;
            const resources = [...workspaceResources];
            workspaceResources.clear();
            subscriber.next({ type: 'workspace-changed', data: { resources } });
          });
        }, 1000);
        workspaceTimer.unref();
      };

      const wake = () => {
        if (subscriber.closed) return;
        requested = true;
        if (reading || timer) return;
        timer = setTimeout(() => {
          timer = undefined;
          void drain();
        }, 100);
      };
      const drain = async () => {
        if (reading || subscriber.closed) return;
        reading = true;
        let batches = 0;
        try {
          while (requested && !subscriber.closed && batches < 5) {
            batches += 1;
            requested = false;
            if (!(await authorized())) return;
            if (cursor === undefined) {
              const latest = await this.reads.run(`latest:${user.id}`, () =>
                this.prisma.videoSummaryEvent.findFirst({
                  where,
                  orderBy: { id: 'desc' },
                  select: { id: true },
                }),
              );
              cursor = latest?.id ?? 0n;
            }
            if (subscriber.closed) return;
            if (!announced) {
              announced = true;
              subscriber.next({
                type: 'connected',
                id: String(cursor),
                data: { cursor: String(cursor), workspaceUpdates: true },
              });
            }
            const afterId = cursor;
            const records = await this.reads.run(
              `events:${user.id}:${afterId}`,
              () =>
                this.prisma.videoSummaryEvent.findMany({
                  where: { ...where, id: { gt: afterId } },
                  select: {
                    id: true,
                    assetId: true,
                    status: true,
                    summary: {
                      select: {
                        ...videoSummaryStateSelect,
                        asset: { select: { name: true } },
                      },
                    },
                  },
                  orderBy: { id: 'asc' },
                  take: 50,
                }),
            );
            if (subscriber.closed) return;
            const latest = new Map<string, (typeof records)[number]>();
            for (const record of records) {
              latest.delete(record.assetId);
              latest.set(record.assetId, record);
            }
            for (const record of latest.values()) {
              cursor = record.id;
              subscriber.next({
                type: 'video-summary',
                id: String(record.id),
                data: {
                  assetId: record.assetId,
                  name: record.summary.asset.name.slice(0, 255),
                  status: record.status,
                  result: serializeVideoSummaryState(record.summary),
                },
              });
            }
            if (records.length === 50) requested = true;
          }
        } catch {
          if (subscriber.closed) return;
          if (Date.now() - this.lastWarningAt > 60000) {
            this.lastWarningAt = Date.now();
            this.logger.warn(
              '视频总结通知读取失败，请检查数据库连接及迁移状态',
            );
          }
          subscriber.error(new Error('视频总结通知暂不可用'));
        } finally {
          reading = false;
          if (requested) wake();
        }
      };
      const changes = this.notifier.changes.subscribe((ownerId) => {
        if (ownerId === undefined || ownerId === user.id) wake();
      });
      const workspaceChanges = this.notifier.workspaceChanges.subscribe(
        (change) => {
          if (change === undefined)
            wakeWorkspace(workspaceNotificationResources);
          else if (change.ownerId === user.id) wakeWorkspace(change.resources);
        },
      );
      wake();
      return () => {
        changes.unsubscribe();
        workspaceChanges.unsubscribe();
        clearTimeout(timer);
        clearTimeout(workspaceTimer);
        clearTimeout(expiry);
        clearInterval(heartbeat);
      };
    }).pipe(takeUntil(this.shutdown));
  }

  private async authorize(user: RequestUser) {
    if (user.tokenExp * 1000 <= Date.now()) return false;
    const [version, [blacklisted, revoked]] = await Promise.all([
      this.users.getSessionVersion(user.id),
      this.redis.getMany([
        RedisKey.blacklist(user.tokenJti),
        ...(user.sessionId
          ? [RedisKey.sessionRevoked(user.id, user.sessionId)]
          : []),
      ]),
    ]);
    if (
      version === null ||
      version !== user.sessionVersion ||
      blacklisted ||
      revoked
    )
      return false;
    const current = await this.users.getAuthUser(user.id, version);
    return Boolean(
      current &&
      (current.roleCode === RoleCode.ADMIN ||
        current.permissions.includes(PermissionCode.ASSET_LIST)),
    );
  }

  onModuleDestroy() {
    this.shutdown.next();
    this.shutdown.complete();
  }
}
