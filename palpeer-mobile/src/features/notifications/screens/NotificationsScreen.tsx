import { router } from 'expo-router';
import { Bell, Settings } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import {
  useGetNotificationsInfiniteQuery,
  useGetUnreadCountQuery,
} from '@/services/api/notificationApi';

import { NotificationRow } from '../components/NotificationRow';
import { uniqueNotifications } from '../logic';
import { useOpenNotification } from '../useOpenNotification';

/** Newest first, 20 per page. There's no mark-all-read or delete in the backend (NT-2). */
export function NotificationsScreen() {
  const theme = useTheme();
  const list = useGetNotificationsInfiniteQuery();
  const unread = useGetUnreadCountQuery();
  const open = useOpenNotification();

  const header = (
    <StackHeader
      title="Notifications"
      right={
        <IconButton
          icon={Settings}
          accessibilityLabel="Notification settings"
          onPress={() => router.push('/notifications/settings')}
          testID="notifications-settings"
        />
      }
    />
  );

  const items = uniqueNotifications(list.data?.pages.flatMap((page) => page.content) ?? []);

  if (!list.data) {
    return (
      <Screen>
        {header}
        {list.error ? (
          <ErrorState error={toAppError(list.error)} onRetry={() => void list.refetch()} />
        ) : (
          <>
            <Skeleton height={72} />
            <Skeleton height={72} />
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={list.isFetching && !list.isLoading && !list.isFetchingNextPage}
          onRefresh={() => {
            void list.refetch();
            void unread.refetch();
          }}
          tintColor={theme.colors.primary}
        />
      }
    >
      {header}
      {list.error ? (
        <FormAlert
          tone="warning"
          message="Couldn't refresh. Pull down to try again."
          testID="notifications-stale"
        />
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          message="Updates about your account and referrals will show here."
        />
      ) : (
        <View style={{ gap: theme.spacing.sm }} testID="notifications-list">
          {items.map((item) => (
            <NotificationRow key={item.id} notification={item} onPress={() => open(item)} />
          ))}
          {list.hasNextPage ? (
            <Button
              label="Load more"
              variant="ghost"
              onPress={() => void list.fetchNextPage()}
              loading={list.isFetchingNextPage}
              testID="notifications-more"
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}
