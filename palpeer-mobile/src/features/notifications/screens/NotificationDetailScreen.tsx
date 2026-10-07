import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/StateViews';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { toAppError } from '@/services/api/errors';
import {
  useGetNotificationQuery,
  useMarkNotificationReadMutation,
} from '@/services/api/notificationApi';
import { notificationTarget } from '@/services/navigation/deepLinks';
import { formatDateTime } from '@/utils/datetime';

import { isUnread } from '../logic';

/** Opened from a push tap or a notification without a mapped screen. Always loaded from the API. */
export function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const notification = useGetNotificationQuery(id);
  const [markRead] = useMarkNotificationReadMutation();
  const header = <StackHeader title="Notification" />;
  const data = notification.data;
  const unread = data ? isUnread(data) : false;

  useEffect(() => {
    if (data && unread) void markRead(data.id);
  }, [data, unread, markRead]);

  if (!data) {
    return (
      <Screen>
        {header}
        {notification.error ? (
          <ErrorState
            error={
              toAppError(notification.error).status === 404
                ? { ...toAppError(notification.error), message: "This notification wasn't found." }
                : toAppError(notification.error)
            }
            onRetry={() => void notification.refetch()}
          />
        ) : (
          <Skeleton height={120} />
        )}
      </Screen>
    );
  }

  const target = notificationTarget(data);

  return (
    <Screen scroll>
      {header}
      <Card variant="outlined" padding="lg">
        <View style={{ gap: 8 }}>
          <AppText variant="h2" testID="notification-title">
            {data.title}
          </AppText>
          <AppText variant="caption" tone="muted">
            {formatDateTime(data.createdAt)}
          </AppText>
          <AppText testID="notification-body">{data.body}</AppText>
        </View>
      </Card>
      {target ? (
        <Button
          label="Open"
          onPress={() => router.push(target as Href)}
          testID="notification-open"
        />
      ) : null}
    </Screen>
  );
}
