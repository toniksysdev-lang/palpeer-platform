import { messagesMenuCount } from '@/features/notifications/logic';
import { useGetChatUnreadCountQuery } from '@/services/api/chatApi';
import { ALERTS_POLL_MS, useGetUnreadCountQuery } from '@/services/api/notificationApi';
import { useAppSelector } from '@/store';

/** Unread badge for the persistent design BottomNav (shared across tab + money-flow screens). */
export function useDesignDockUnread(): number {
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const notifUnread = useGetUnreadCountQuery(undefined, {
    skip: !authenticated,
    pollingInterval: authenticated ? ALERTS_POLL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const chatUnread = useGetChatUnreadCountQuery(undefined, {
    skip: !authenticated,
    pollingInterval: authenticated ? ALERTS_POLL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  return messagesMenuCount(notifUnread.data, chatUnread.data);
}
