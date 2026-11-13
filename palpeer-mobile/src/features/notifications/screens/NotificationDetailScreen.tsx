import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { isUnread } from '@/features/notifications/logic';
import { toAppError } from '@/services/api/errors';
import {
  useGetNotificationQuery,
  useMarkNotificationReadMutation,
} from '@/services/api/notificationApi';
import { notificationTarget } from '@/services/navigation/deepLinks';
import { formatDateTime } from '@/utils/datetime';
import { Btn, Card, H1, Loading, Screen, TopBar, Txt } from '@/newui/ui/kit';

/** Opened from a push tap or a notification without a mapped screen. Always loaded from the API. */
export function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const notification = useGetNotificationQuery(id);
  const [markRead] = useMarkNotificationReadMutation();
  const data = notification.data;
  const unread = data ? isUnread(data) : false;
  const isAdminMessage =
    data?.referenceType?.toUpperCase() === 'ADMIN_BROADCAST' ||
    data?.category?.toUpperCase() === 'ADMIN';

  useEffect(() => {
    if (data && unread) void markRead(data.id);
  }, [data, unread, markRead]);

  const say = useMemo(() => {
    if (!data) return isAdminMessage ? 'Message' : 'Notification';
    return `${data.title}. ${data.body}`;
  }, [data, isAdminMessage]);

  if (!data) {
    if (notification.error) {
      const err = toAppError(notification.error);
      const message =
        err.status === 404 ? "This notification wasn't found." : err.message ?? 'Could not load.';
      return (
        <Screen gap={12}>
          <TopBar say={message} />
          <H1>{isAdminMessage ? 'Message' : 'Notification'}</H1>
          <Txt size={17} color="text2" noTr>
            {message}
          </Txt>
          <Btn label="Try again" onPress={() => void notification.refetch()} />
        </Screen>
      );
    }
    return (
      <Screen>
        <TopBar />
        <Loading title="Loading" text="Just a moment." />
      </Screen>
    );
  }

  const target = notificationTarget(data);

  return (
    <Screen scroll gap={12}>
      <TopBar say={say} />
      <H1>{isAdminMessage ? 'Message' : 'Notification'}</H1>
      <Card gap={8}>
        {isAdminMessage ? (
          <Txt size={15} w="700" color="text3">
            From Palpeer
          </Txt>
        ) : null}
        <View testID="notification-title">
          <Txt size={22} w="800" noTr>
            {data.title}
          </Txt>
        </View>
        <Txt size={15} w="600" color="text3" noTr>
          {formatDateTime(data.createdAt)}
        </Txt>
        <View testID="notification-body">
          <Txt size={17} color="text2" noTr>
            {data.body}
          </Txt>
        </View>
      </Card>
      {target ? (
        <Btn label="Open" onPress={() => router.push(target as Href)} testID="notification-open" />
      ) : null}
    </Screen>
  );
}
