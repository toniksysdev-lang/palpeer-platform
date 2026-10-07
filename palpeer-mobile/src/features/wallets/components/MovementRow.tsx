import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import type { TransactionItemResponse } from '@/types/api/wallet';
import { formatDateTime } from '@/utils/datetime';

import { useMoneyFormat } from '../useMoneyFormat';

/** A funding or withdrawal from the transactions feed, linking to its live status. */
export function MovementRow({
  item,
  onPress,
}: {
  item: TransactionItemResponse;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const funding = item.type === 'FUNDING';
  const label = funding ? 'Funding' : 'Withdrawal';

  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={onPress}
      accessibilityLabel={`${label} ${format(item.amount, item.currencyCode)}`}
      testID={`movement-${item.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Icon icon={funding ? ArrowDownLeft : ArrowUpRight} color={theme.colors.primary} />
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <AppText variant="bodyStrong">
            {label} · {format(item.amount, item.currencyCode)}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {formatDateTime(item.createdAt)}
          </AppText>
        </View>
        <StatusBadge status={item.status} />
        <Icon icon={ChevronRight} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}
