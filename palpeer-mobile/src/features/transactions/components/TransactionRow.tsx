import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  ArrowUpRight,
  ChevronRight,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import type { TransactionActivityType, TransactionItemResponse } from '@/types/api/transaction';
import { formatClockTime, formatDateTime } from '@/utils/datetime';

import { typeLabel } from '../logic';

const ICONS: Record<TransactionActivityType, LucideIcon> = {
  FUNDING: ArrowDownLeft,
  WITHDRAWAL: ArrowUpRight,
  EXCHANGE: ArrowLeftRight,
  TRANSFER: ArrowRightLeft,
  P2P: Users,
};

/** "100.00 CAD → 108,945.12 NGN" for exchanges/P2P; the single amount otherwise. */
export function useTransactionAmount() {
  const { format } = useMoneyFormat();
  return (item: TransactionItemResponse) => {
    const source = format(item.amount, item.currencyCode);
    if (
      (item.type !== 'EXCHANGE' && item.type !== 'P2P') ||
      !item.secondaryAmount ||
      !item.secondaryCurrencyCode
    ) {
      return source;
    }
    return `${source} → ${format(item.secondaryAmount, item.secondaryCurrencyCode)}`;
  };
}

/**
 * One funding, withdrawal or exchange. Amounts carry no +/− sign: whether money actually moved
 * depends on the status, which is shown next to it.
 */
export function TransactionRow({
  item,
  onPress,
  timeOnly = false,
}: {
  item: TransactionItemResponse;
  onPress: () => void;
  /** Inside a day group only the time is needed. */
  timeOnly?: boolean;
}) {
  const theme = useTheme();
  const amount = useTransactionAmount()(item);
  const label =
    (item.type === 'EXCHANGE' || item.type === 'P2P') && item.secondaryCurrencyCode
      ? `${typeLabel(item.type)} ${item.currencyCode} → ${item.secondaryCurrencyCode}`
      : `${typeLabel(item.type)} · ${item.currencyCode}`;
  const when = timeOnly ? formatClockTime(item.createdAt) : formatDateTime(item.createdAt);

  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={onPress}
      accessibilityLabel={`${label}, ${amount}, ${item.status.toLowerCase()}`}
      testID={`transaction-${item.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Icon icon={ICONS[item.type]} color={theme.colors.primary} />
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <AppText variant="bodyStrong">{label}</AppText>
          <AppText tone="secondary" testID={`transaction-${item.id}-amount`}>
            {amount}
          </AppText>
          {when ? (
            <AppText variant="caption" tone="muted">
              {when}
            </AppText>
          ) : null}
        </View>
        <StatusBadge status={item.status} />
        <Icon icon={ChevronRight} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}
