import type { NotificationResponse } from '@/types/api/notification';

/** Matches the backend unread count: `PENDING` and `SENT` are unread. */
export function isUnread(notification: Pick<NotificationResponse, 'status'>): boolean {
  return notification.status === 'PENDING' || notification.status === 'SENT';
}

/** "9+" style badge text; nothing for zero. */
export function badgeLabel(count: number | undefined): string | null {
  if (!count || count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}

/** Footer Messages badge: unread Alerts + unread chat rooms. */
export function messagesMenuCount(
  notificationUnread: number | undefined,
  chatUnread: number | undefined,
): number {
  return Math.max(0, notificationUnread ?? 0) + Math.max(0, chatUnread ?? 0);
}

export function uniqueNotifications(items: NotificationResponse[]): NotificationResponse[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
