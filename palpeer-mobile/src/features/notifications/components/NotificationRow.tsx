import { Bell, ChevronRight, Gift } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import type { NotificationResponse } from '@/types/api/notification';
import { formatDateTime } from '@/utils/datetime';

import { isUnread } from '../logic';

export function NotificationRow({
  notification,
  onPress,
}: {
  notification: NotificationResponse;
  onPress: () => void;
}) {
  const theme = useTheme();
  const unread = isUnread(notification);
  const icon = notification.category?.toUpperCase() === 'REFERRAL' ? Gift : Bell;

  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={onPress}
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${notification.title}. ${notification.body}`}
      testID={`notification-${notification.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}>
        <Icon icon={icon} color={theme.colors.primary} />
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            {unread ? (
              <View
                testID={`notification-${notification.id}-unread`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.colors.primary,
                }}
              />
            ) : null}
            <AppText variant={unread ? 'bodyStrong' : 'body'} style={{ flex: 1 }} numberOfLines={1}>
              {notification.title}
            </AppText>
          </View>
          <AppText tone="secondary" numberOfLines={2}>
            {notification.body}
          </AppText>
          <AppText variant="caption" tone="muted">
            {formatDateTime(notification.createdAt)}
          </AppText>
        </View>
        <Icon icon={ChevronRight} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}
