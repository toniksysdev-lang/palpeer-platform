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

export function uniqueNotifications(items: NotificationResponse[]): NotificationResponse[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
