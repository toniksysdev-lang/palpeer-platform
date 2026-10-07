import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetUnreadCountQuery } from '@/services/api/notificationApi';
import { palette } from '@/theme/colors';

import { badgeLabel } from '../logic';

export function NotificationBell() {
  const theme = useTheme();
  const unread = useGetUnreadCountQuery();
  const label = badgeLabel(unread.data);

  return (
    <View>
      <IconButton
        icon={Bell}
        accessibilityLabel={label ? `Notifications, ${unread.data} unread` : 'Notifications'}
        onPress={() => router.push('/notifications')}
        testID="home-notifications"
      />
      {label ? (
        <View
          pointerEvents="none"
          testID="home-notifications-badge"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 18,
            minHeight: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: theme.colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="caption"
            maxFontSizeMultiplier={1.3}
            style={{ color: palette.neutral0, fontSize: 11, lineHeight: 14 }}
          >
            {label}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
