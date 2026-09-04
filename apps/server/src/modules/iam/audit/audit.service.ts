import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

type AuditInput = {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
};

@Injectable()
export class AuditService {
  constructor(private readonly prismaService: PrismaService) {}

  record(input: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    metadata?: unknown;
  }) {
    return this.prismaService.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        beforeJson: input.before as any,
        afterJson: input.after as any,
        metadataJson: input.metadata as any,
      },
    });
  }
}
