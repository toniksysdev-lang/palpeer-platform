import { CircleCheck, CircleX, Clock, RotateCcw, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import type { MoneyMovementStatus } from '@/types/api/wallet';

const ICONS: Partial<Record<string, LucideIcon>> & Record<MoneyMovementStatus, LucideIcon> = {
  INITIATED: Clock,
  PENDING: Clock,
  PROCESSING: Clock,
  SUCCESS: CircleCheck,
  FAILED: CircleX,
  REVERSED: RotateCcw,
};

type Props = {
  /** Funding/withdrawal or exchange status; anything unrecognised shows as in progress. */
  status: string;
  amount: string;
  title: string;
  message: string;
};

export function MovementStatusHeader({ status, amount, title, message }: Props) {
  const theme = useTheme();
  const color =
    status === 'SUCCESS'
      ? theme.colors.success
      : status === 'FAILED'
        ? theme.colors.danger
        : status === 'REVERSED'
          ? theme.colors.textSecondary
          : theme.colors.warning;

  return (
    <View
      style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg }}
      accessibilityLiveRegion="polite"
    >
      <Icon icon={ICONS[status] ?? Clock} size="xl" color={color} />
      <AppText variant="amount" align="center" testID="movement-amount">
        {amount}
      </AppText>
      <StatusBadge status={status} testID="movement-status" />
      <AppText variant="h3" align="center" accessibilityRole="header" testID="movement-title">
        {title}
      </AppText>
      <AppText tone="secondary" align="center" testID="movement-message">
        {message}
      </AppText>
    </View>
  );
}
