import { View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { toneColors, type Tone } from '@/theme';
import { humanizeStatus, toneForStatus } from '@/utils/status';

import { AppText } from './AppText';

type BadgeProps = {
  label: string;
  tone?: Tone;
  testID?: string;
};

export function Badge({ label, tone = 'neutral', testID }: BadgeProps) {
  const theme = useTheme();
  const { fg, bg } = toneColors(theme, tone);
  return (
    <View
      testID={testID}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.radius.pill,
        backgroundColor: bg,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />
      <AppText variant="caption" style={{ color: fg, fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}

/** Badge for a backend status enum value; tone and label derive from the value itself. */
export function StatusBadge({
  status,
  testID,
}: {
  status: string | null | undefined;
  testID?: string;
}) {
  return <Badge label={humanizeStatus(status)} tone={toneForStatus(status)} testID={testID} />;
}
