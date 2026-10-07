import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';

type Props = {
  leading?: ReactNode;
  title: string;
  subtitle?: string | null;
  trailingTitle?: string | null;
  trailingSubtitle?: string | null;
  onPress?: () => void;
  /** Hairline under the row, for rows stacked in a list. */
  divider?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  trailingTitleTestID?: string;
};

/** A flat list row: leading visual, title/subtitle on the left and a value/detail on the right. */
export function ListItem({
  leading,
  title,
  subtitle,
  trailingTitle,
  trailingSubtitle,
  onPress,
  divider = false,
  accessibilityLabel,
  testID,
  trailingTitleTestID,
}: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: theme.colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailingTitle || trailingSubtitle ? (
        <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 1 }}>
          {trailingTitle ? (
            <AppText variant="bodyStrong" numberOfLines={1} testID={trailingTitleTestID}>
              {trailingTitle}
            </AppText>
          ) : null}
          {trailingSubtitle ? (
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              {trailingSubtitle}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
