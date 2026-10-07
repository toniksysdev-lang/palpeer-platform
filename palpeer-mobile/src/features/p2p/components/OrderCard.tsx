import { ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import type { P2POrderSummaryResponse } from '@/types/api/p2p';
import { formatDateTime } from '@/utils/datetime';

import { orderRole, p2pRateLine } from '../logic';

export function OrderCard({
  order,
  userId,
  onPress,
}: {
  order: P2POrderSummaryResponse;
  userId: string | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const base = order.baseCurrencyCode;
  const quote = order.quoteCurrencyCode;
  const role =
    orderRole(order, userId) === 'acceptor' ? 'You accepted' : 'Your request was accepted';
  const amount = base ? format(order.amount, base) : order.amount;

  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={onPress}
      accessibilityLabel={`Order ${base ?? ''}/${quote ?? ''}, ${amount}, ${role}`}
      testID={`p2p-order-${order.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <AppText variant="bodyStrong">{base && quote ? `${base}/${quote}` : 'P2P order'}</AppText>
          <AppText variant="caption" tone="secondary">
            {role}
          </AppText>
          <AppText variant="h3">{amount}</AppText>
          {base && quote ? (
            <AppText tone="secondary">{p2pRateLine(order.rate, base, quote)}</AppText>
          ) : null}
          <AppText variant="caption" tone="muted">
            {formatDateTime(order.createdAt)}
          </AppText>
        </View>
        <StatusBadge status={order.status} />
        <Icon icon={ChevronRight} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}
