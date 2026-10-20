import { ChevronRight, Share2 } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import type { P2PRequestResponse } from '@/types/api/p2p';
import { formatDateTime } from '@/utils/datetime';

import { ExpiryCountdown } from './ExpiryCountdown';
import { FlippableRateLine } from './FlippableRateLine';
import { effectiveStatus, preferredRateUnit, p2pRateLine, sideLabel } from '../logic';
import { canShareSellOrder, shareSellOrder } from '../shareSellOrder';

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
  const toast = useToast();
  const { format } = useMoneyFormat();
  const { baseCurrencyCode: base, quoteCurrencyCode: quote } = request;
  const label = sideLabel(request.side, base, quote, own ? 'self' : 'other');
  const amount = format(request.amount, base);
  const status = effectiveStatus(request, now);
  const showCountdown = status === 'OPEN' && !!request.expiresAt;
  const rateLine = p2pRateLine(request.rate, base, quote, preferredRateUnit(base, quote));
  const shareable = canShareSellOrder(request, own, status);

  const onShare = async () => {
    try {
      await shareSellOrder(request, amount);
    } catch {
      toast.show({ type: 'error', title: "Couldn't open the share sheet" });
    }
  };

  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={onPress}
      accessibilityLabel={`${label}, ${amount}, ${rateLine}`}
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
          <FlippableRateLine
            rate={request.rate}
            base={base}
            quote={quote}
            testID={`p2p-request-rate-${request.id}`}
          />
          {showCountdown ? (
            <ExpiryCountdown
              expiresAt={request.expiresAt}
              active
              testID={`p2p-request-expiry-${request.id}`}
            />
          ) : (
            <AppText variant="caption" tone="muted">
              {formatDateTime(request.createdAt)}
            </AppText>
          )}
        </View>
        {shareable ? (
          <IconButton
            icon={Share2}
            accessibilityLabel="Share Your Sell Order"
            onPress={() => void onShare()}
            testID={`p2p-share-${request.id}`}
          />
        ) : null}
        {showStatus ? <StatusBadge status={status} /> : null}
        <Icon icon={ChevronRight} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}
