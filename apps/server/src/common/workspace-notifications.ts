import type { Prisma } from '../prisma/generated/prisma/client';

export const WORKSPACE_NOTIFY_CHANNEL = 'image_stack_workspace';
export const workspaceNotificationResources = [
  'ai',
  'processing',
  'overview',
  'places',
  'search',
] as const;

export type WorkspaceNotificationResource =
  (typeof workspaceNotificationResources)[number];

export interface WorkspaceNotification {
  ownerId: string;
  resources: WorkspaceNotificationResource[];
}

export function parseWorkspaceNotification(
  value: unknown,
): WorkspaceNotification | null {
  if (!value || typeof value !== 'object') return null;
  const notification = value as Record<string, unknown>;
  if (
    typeof notification.ownerId !== 'string' ||
    !Array.isArray(notification.resources) ||
    !notification.resources.length ||
    notification.resources.length > workspaceNotificationResources.length ||
    !notification.resources.every((resource) =>
      workspaceNotificationResources.includes(resource),
    )
  )
    return null;
  return notification as unknown as WorkspaceNotification;
}

export async function notifyWorkspaceChange(
  transaction: Prisma.TransactionClient,
  ownerId: string,
  resources: readonly WorkspaceNotificationResource[],
) {
  await transaction.$executeRaw`SELECT pg_notify(${WORKSPACE_NOTIFY_CHANNEL}, ${JSON.stringify({ ownerId, resources })})`;
}
