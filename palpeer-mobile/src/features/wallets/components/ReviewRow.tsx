import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/providers/ThemeProvider';

export function ReviewRow({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}
    >
      <AppText tone="secondary" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" align="right" style={{ flex: 2 }} testID={testID} selectable>
        {value}
      </AppText>
    </View>
  );
}
