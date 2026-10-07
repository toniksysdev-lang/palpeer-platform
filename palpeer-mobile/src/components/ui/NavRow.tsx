import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { Card } from './Card';
import { Icon } from './Icon';

type Props = {
  icon: LucideIcon;
  title: string;
  detail?: string;
  /** Replaces the chevron (e.g. a badge or switch). */
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
};

/** Outlined row used by the profile, settings, privacy and help screens. */
export function NavRow({ icon, title, detail, right, onPress, destructive, testID }: Props) {
  const theme = useTheme();
  const color = destructive ? theme.colors.danger : theme.colors.primary;
  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={onPress}
      accessibilityLabel={title}
      testID={testID}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Icon icon={icon} color={color} />
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <AppText variant="bodyStrong" style={destructive ? { color } : undefined}>
            {title}
          </AppText>
          {detail ? (
            <AppText variant="caption" tone="secondary">
              {detail}
            </AppText>
          ) : null}
        </View>
        {right ?? (onPress ? <Icon icon={ChevronRight} color={theme.colors.textMuted} /> : null)}
      </View>
    </Card>
  );
}

/** Overline title above a group of rows. */
export function RowSection({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="overline" tone="muted">
        {title}
      </AppText>
      {children}
    </View>
  );
}
