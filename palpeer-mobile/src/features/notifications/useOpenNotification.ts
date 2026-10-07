import { router, type Href } from 'expo-router';
import { useCallback } from 'react';

import { useMarkNotificationReadMutation } from '@/services/api/notificationApi';
import { notificationTarget } from '@/services/navigation/deepLinks';
import type { NotificationResponse } from '@/types/api/notification';

import { isUnread } from './logic';

/**
 * Marks the notification read (best effort) and opens the screen it refers to, or its detail
 * when there's no mapped screen. The target screen loads its own data (R-NT-1).
 */
export function useOpenNotification() {
  const [markRead] = useMarkNotificationReadMutation();

  return useCallback(
    (notification: NotificationResponse) => {
      if (isUnread(notification)) void markRead(notification.id);
      const target = notificationTarget(notification);
      if (target) {
        router.push(target as Href);
      } else {
        router.push({ pathname: '/notifications/[id]', params: { id: notification.id } });
      }
    },
    [markRead],
  );
}
