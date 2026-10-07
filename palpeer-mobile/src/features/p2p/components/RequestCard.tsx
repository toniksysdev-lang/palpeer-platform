import { ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import type { P2PRequestResponse } from '@/types/api/p2p';
import { formatDateTime } from '@/utils/datetime';

import { effectiveStatus, p2pRateLine, sideLabel } from '../logic';

export function RequestCard({
  request,
  own,
  now,
  showStatus = false,
  onPress,
}: {
  request: P2PRequestResponse;
  own: boolean;
  now: number;
  showStatus?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const { baseCurrencyCode: base, quoteCurrencyCode: quote } = request;
  const label = sideLabel(request.side, base, quote, own ? 'self' : 'other');
  const amount = format(request.amount, base);

  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={onPress}
      accessibilityLabel={`${label}, ${amount}, ${p2pRateLine(request.rate, base, quote)}`}
      testID={`p2p-request-${request.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <AppText variant="bodyStrong" style={{ flexShrink: 1 }}>
              {base}/{quote}
            </AppText>
            <Badge label={request.side === 'BUY' ? 'Buy' : 'Sell'} tone="info" />
            {own && !showStatus ? <Badge label="Yours" /> : null}
          </View>
          <AppText variant="caption" tone="secondary">
            {label}
          </AppText>
          <AppText variant="h3">{amount}</AppText>
          <AppText tone="secondary">{p2pRateLine(request.rate, base, quote)}</AppText>
          <AppText variant="caption" tone="muted">
            {formatDateTime(request.createdAt)}
          </AppText>
        </View>
        {showStatus ? <StatusBadge status={effectiveStatus(request, now)} /> : null}
        <Icon icon={ChevronRight} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}
