import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from '@/providers/ThemeProvider';

type Props = {
  title?: string;
  /** Defaults to `router.back()`; screens reached by replace can send the user somewhere explicit. */
  onBack?: () => void;
  right?: ReactNode;
};

/** Back button + optional title row for stack screens inside the signed-in app. */
export function StackHeader({ title, onBack, right }: Props) {
  const theme = useTheme();
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -theme.spacing.sm,
        minHeight: 44,
      }}
    >
      <IconButton
        icon={ArrowLeft}
        accessibilityLabel="Go back"
        onPress={handleBack}
        testID="header-back"
      />
      {title ? (
        <AppText
          variant="h3"
          accessibilityRole="header"
          align="center"
          style={{ flex: 1, marginRight: 40 }}
          numberOfLines={1}
        >
          {title}
        </AppText>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}
