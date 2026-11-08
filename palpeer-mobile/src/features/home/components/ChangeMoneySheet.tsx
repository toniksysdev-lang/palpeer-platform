import { router } from 'expo-router';
import { ArrowLeftRight, Users } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/providers/ThemeProvider';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** Home Change tile — Change now (exchange) or Choose a person (P2P). */
export function ChangeMoneySheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const t = useT();

  const go = (href: '/exchange' | '/p2p') => {
    onClose();
    router.navigate(href);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('change.title')}
      testID="change-money-sheet"
    >
      <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}>
        <Pressable
          onPress={() => go('/exchange')}
          accessibilityRole="button"
          testID="change-now"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          <Icon icon={ArrowLeftRight} color={theme.colors.primary} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="bodyStrong">{t('change.now')}</AppText>
            <AppText variant="caption" tone="secondary">
              {t('change.nowHint')}
            </AppText>
          </View>
        </Pressable>
        <Pressable
          onPress={() => go('/p2p')}
          accessibilityRole="button"
          testID="choose-a-person"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          <Icon icon={Users} color={theme.colors.primary} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="bodyStrong">{t('change.choosePerson')}</AppText>
            <AppText variant="caption" tone="secondary">
              {t('change.choosePersonHint')}
            </AppText>
          </View>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
