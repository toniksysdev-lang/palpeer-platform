import { ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { p2pRateLine } from '@/features/p2p/logic';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetRequestQuery } from '@/services/api/p2pApi';
import type { NegotiationResponse } from '@/types/api/negotiation';

import { currentOffer, negotiationRole, negotiationSummary, offerAuthor } from '../logic';

/** Pair comes from the P2P request (the negotiation only carries its id). */
export function NegotiationCard({
  negotiation,
  userId,
  onPress,
}: {
  negotiation: NegotiationResponse;
  userId: string | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const request = useGetRequestQuery(negotiation.p2pRequestId);
  const offer = currentOffer(negotiation) ?? negotiation.offers[negotiation.offers.length - 1];
  const base = request.data?.baseCurrencyCode;
  const quote = request.data?.quoteCurrencyCode;
  const role =
    negotiationRole(negotiation, userId) === 'owner' ? 'Offer on your request' : 'Your offer';
  const summary = negotiationSummary(negotiation, userId);

  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={onPress}
      accessibilityLabel={`${role}${base ? ` ${base}/${quote}` : ''}, ${summary}`}
      testID={`negotiation-${negotiation.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <AppText variant="bodyStrong">{base && quote ? `${base}/${quote}` : 'P2P offer'}</AppText>
          <AppText variant="caption" tone="secondary">
            {role} · {summary}
          </AppText>
          {offer && base && quote ? (
            <AppText tone="secondary">
              {offerAuthor(offer, userId)} {format(offer.amount, base)} at{' '}
              {p2pRateLine(offer.rate, base, quote)}
            </AppText>
          ) : null}
        </View>
        <StatusBadge status={negotiation.status} />
        <Icon icon={ChevronRight} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}
