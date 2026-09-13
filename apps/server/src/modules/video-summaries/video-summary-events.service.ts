import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, Subject, takeUntil } from 'rxjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestUser } from '../iam/auth/auth.type';
import type { Prisma } from '../../prisma/generated/prisma/client';
import { summaryVideoWhere } from './video-summary.constants';

@Injectable()
export class VideoSummaryEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(VideoSummaryEventsService.name);
  private readonly shutdown = new Subject<void>();
  private lastWarningAt = 0;

  constructor(private readonly prisma: PrismaService) {}

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
      const expiry = setTimeout(
        () => subscriber.complete(),
        Math.max(1, Math.min(55000, user.tokenExp * 1000 - Date.now())),
      );
      const heartbeat = setInterval(
        () =>
          subscriber.next({
            type: 'heartbeat',
            data: { time: Date.now() },
          }),
        15000,
      );
      const poll = async () => {
        try {
          if (cursor === undefined) {
            const latest = await this.prisma.videoSummaryEvent.findFirst({
              where,
              orderBy: { id: 'desc' },
              select: { id: true },
            });
            cursor = latest?.id ?? 0n;
            if (subscriber.closed) return;
            subscriber.next({
              type: 'connected',
              id: String(cursor),
              data: { cursor: String(cursor) },
            });
          }
          const records = await this.prisma.videoSummaryEvent.findMany({
            where: { ...where, id: { gt: cursor } },
            select: {
              id: true,
              assetId: true,
              status: true,
              summary: { select: { asset: { select: { name: true } } } },
            },
            orderBy: { id: 'asc' },
            take: 50,
          });
          if (subscriber.closed) return;
          for (const record of records) {
            cursor = record.id;
            subscriber.next({
              type: 'video-summary',
              id: String(record.id),
              data: {
                assetId: record.assetId,
                name: record.summary.asset.name,
                status: record.status,
              },
            });
          }
          timer = setTimeout(
            () => void poll(),
            records.length === 50 ? 0 : 3000,
          );
        } catch {
          if (subscriber.closed) return;
          if (Date.now() - this.lastWarningAt > 60000) {
            this.lastWarningAt = Date.now();
            this.logger.warn(
              '视频总结通知读取失败，请检查数据库连接及迁移状态',
            );
          }
          subscriber.error(new Error('视频总结通知暂不可用'));
        }
      };
      void poll();
      return () => {
        clearTimeout(timer);
        clearTimeout(expiry);
        clearInterval(heartbeat);
      };
    }).pipe(takeUntil(this.shutdown));
  }

  onModuleDestroy() {
    this.shutdown.next();
    this.shutdown.complete();
  }
}
